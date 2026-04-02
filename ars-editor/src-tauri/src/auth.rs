use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Json, Redirect},
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use ars_core::models::{User, Session};
use crate::app_state::AppState;

const SESSION_COOKIE: &str = "ars_session";
const CSRF_STATE_COOKIE: &str = "ars_oauth_state";
/// デフォルト TTL (Infisical 未設定時のフォールバック)
const DEFAULT_SESSION_TTL_SECS: i64 = 7 * 24 * 60 * 60;

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct GitHubUser {
    id: i64,
    login: String,
    name: Option<String>,
    avatar_url: String,
    email: Option<String>,
}

/// GET /auth/github/login - Redirect to GitHub OAuth with CSRF state
pub async fn github_login(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), (StatusCode, String)> {
    let csrf_state = Uuid::new_v4().to_string();
    let redirect_uri = state.github_redirect_uri().await;
    let is_https = redirect_uri.starts_with("https://");

    let state_cookie = Cookie::build((CSRF_STATE_COOKIE, csrf_state.clone()))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::minutes(10))
        .same_site(axum_extra::extract::cookie::SameSite::Strict)
        .secure(is_https);

    let client_id = state.github_client_id().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get GitHub client ID: {}", e)))?;

    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=read:user%20user:email%20repo&state={}",
        client_id,
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&csrf_state),
    );
    Ok((jar.add(state_cookie), Redirect::temporary(&url)))
}

/// GET /auth/github/callback - Handle OAuth callback with CSRF validation
pub async fn github_callback(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), (StatusCode, String)> {
    // Validate CSRF state
    let expected_state = jar
        .get(CSRF_STATE_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or((StatusCode::BAD_REQUEST, "Missing OAuth state cookie".to_string()))?;
    let actual_state = query.state
        .ok_or((StatusCode::BAD_REQUEST, "Missing state parameter".to_string()))?;
    if expected_state != actual_state {
        return Err((StatusCode::BAD_REQUEST, "Invalid OAuth state (CSRF check failed)".to_string()));
    }

    // Fetch secrets on-demand from Infisical
    let client_id = state.github_client_id().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get GitHub client ID: {}", e)))?;
    let client_secret = state.github_client_secret().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get GitHub client secret: {}", e)))?;
    let redirect_uri = state.github_redirect_uri().await;

    // Exchange code for access token
    let client = reqwest::Client::new();
    let token_res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": query.code,
            "redirect_uri": redirect_uri,
        }))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Token exchange failed: {}", e)))?;

    let token_data: GitHubTokenResponse = token_res
        .json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to parse token response: {}", e)))?;

    // Fetch GitHub user info
    let gh_user: GitHubUser = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token_data.access_token))
        .header("User-Agent", "ArsEditor")
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to fetch user: {}", e)))?
        .json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to parse user: {}", e)))?;

    let now = Utc::now().to_rfc3339();

    // Find or create user
    let user = match state.user_repo.get_by_provider_id("github", &gh_user.id.to_string()).await {
        Ok(Some(mut existing)) => {
            existing.login = gh_user.login;
            existing.display_name = gh_user.name.unwrap_or_else(|| existing.login.clone());
            existing.avatar_url = gh_user.avatar_url;
            existing.email = gh_user.email;
            existing.updated_at = now.clone();
            state.user_repo.put(&existing).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update user: {}", e)))?;
            existing
        }
        Ok(None) => {
            let new_user = User {
                id: Uuid::new_v4().to_string(),
                github_id: gh_user.id,
                login: gh_user.login.clone(),
                display_name: gh_user.name.unwrap_or(gh_user.login),
                avatar_url: gh_user.avatar_url,
                email: gh_user.email,
                created_at: now.clone(),
                updated_at: now.clone(),
            };
            state.user_repo.put(&new_user).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {}", e)))?;
            new_user
        }
        Err(e) => {
            return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)));
        }
    };

    // Create session (access token stored in-memory only, not in Redis)
    let session_ttl = state.session_ttl_secs().await;
    let session_id = Uuid::new_v4().to_string();
    let session = Session {
        id: session_id.clone(),
        user_id: user.id,
        expires_at: Some((Utc::now() + chrono::Duration::seconds(session_ttl)).to_rfc3339()),
        created_at: now,
        access_token: String::new(), // トークンは Redis に保存しない
    };
    state.redis.put_session(&session).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create session: {}", e)))?;

    // アクセストークンはオンメモリで管理
    state.token_store.insert(session_id.clone(), token_data.access_token.clone());

    let cookie = Cookie::build((SESSION_COOKIE, session.id))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::seconds(session_ttl))
        .same_site(axum_extra::extract::cookie::SameSite::Strict)
        .secure(redirect_uri.starts_with("https://"));

    // Clear the CSRF state cookie
    let clear_csrf = Cookie::build((CSRF_STATE_COOKIE, ""))
        .path("/")
        .max_age(time::Duration::seconds(0));

    Ok((jar.add(cookie).remove(clear_csrf), Redirect::temporary("/")))
}

/// GET /auth/me - Get current user
pub async fn get_me(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<User>, (StatusCode, String)> {
    let user = extract_user(&state, &jar).await?;
    Ok(Json(user))
}

/// POST /auth/logout - Clear session
pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, Json<()>), (StatusCode, String)> {
    if let Some(session_id) = jar.get(SESSION_COOKIE).map(|c| c.value().to_string()) {
        let _ = state.redis.delete_session(&session_id).await;
        state.token_store.remove(&session_id);
    }
    let cookie = Cookie::build((SESSION_COOKIE, ""))
        .path("/")
        .max_age(time::Duration::seconds(0));
    Ok((jar.remove(cookie), Json(())))
}

/// Extract session from cookie (Redis + in-memory token)
pub async fn extract_session(state: &AppState, jar: &CookieJar) -> Result<Session, (StatusCode, String)> {
    let session_id = jar
        .get(SESSION_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let mut session = state
        .redis
        .get_session(&session_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Session lookup failed: {}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "Session not found".to_string()))?;

    if let Some(ref expires_at_str) = session.expires_at {
        let expires_at = chrono::DateTime::parse_from_rfc3339(expires_at_str)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid session expiry".to_string()))?;
        if Utc::now() > expires_at {
            let _ = state.redis.delete_session(&session_id).await;
            state.token_store.remove(&session_id);
            return Err((StatusCode::UNAUTHORIZED, "Session expired".to_string()));
        }
    }

    // オンメモリからアクセストークンを復元
    if let Some(token) = state.token_store.get(&session_id) {
        session.access_token = token.clone();
    }

    Ok(session)
}

/// Extract user from session cookie (Redis + SurrealDB)
pub async fn extract_user(state: &AppState, jar: &CookieJar) -> Result<User, (StatusCode, String)> {
    let session_id = jar
        .get(SESSION_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let session = state
        .redis
        .get_session(&session_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Session lookup failed: {}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "Session not found".to_string()))?;

    // Check expiration
    if let Some(ref expires_at_str) = session.expires_at {
        let expires_at = chrono::DateTime::parse_from_rfc3339(expires_at_str)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid session expiry".to_string()))?;
        if Utc::now() > expires_at {
            let _ = state.redis.delete_session(&session_id).await;
            state.token_store.remove(&session_id);
            return Err((StatusCode::UNAUTHORIZED, "Session expired".to_string()));
        }
    }

    state
        .user_repo
        .get(&session.user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("User lookup failed: {}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))
}

