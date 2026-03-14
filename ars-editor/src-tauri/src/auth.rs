use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Json, Redirect},
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app_state::AppState;

const SESSION_COOKIE: &str = "ars_session";
const SESSION_TTL_SECS: i64 = 7 * 24 * 60 * 60; // 7 days

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    #[serde(rename = "githubId")]
    pub github_id: i64,
    pub login: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: String,
    pub email: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "accessToken")]
    pub access_token: String,
}

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    #[allow(dead_code)]
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

/// GET /auth/github/login - Redirect to GitHub OAuth
pub async fn github_login(State(state): State<AppState>) -> Redirect {
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=read:user%20user:email%20repo",
        state.github_client_id,
        urlencoding::encode(&state.github_redirect_uri),
    );
    Redirect::temporary(&url)
}

/// GET /auth/github/callback - Handle OAuth callback
pub async fn github_callback(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), (StatusCode, String)> {
    // Exchange code for access token
    let client = reqwest::Client::new();
    let token_res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": state.github_client_id,
            "client_secret": state.github_client_secret,
            "code": query.code,
            "redirect_uri": state.github_redirect_uri,
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

    // Find or create user in DynamoDB
    let user = match state.dynamo.get_user_by_github_id(gh_user.id).await {
        Ok(Some(mut existing)) => {
            existing.login = gh_user.login;
            existing.display_name = gh_user.name.unwrap_or_else(|| existing.login.clone());
            existing.avatar_url = gh_user.avatar_url;
            existing.email = gh_user.email;
            existing.updated_at = now.clone();
            state.dynamo.put_user(&existing).await
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
            state.dynamo.put_user(&new_user).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {}", e)))?;
            new_user
        }
        Err(e) => {
            return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("DynamoDB error: {}", e)));
        }
    };

    // Create session (store access token for Git operations)
    let session = Session {
        id: Uuid::new_v4().to_string(),
        user_id: user.id,
        expires_at: (Utc::now() + chrono::Duration::seconds(SESSION_TTL_SECS)).to_rfc3339(),
        created_at: now,
        access_token: token_data.access_token.clone(),
    };
    state.dynamo.put_session(&session).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create session: {}", e)))?;

    let cookie = Cookie::build((SESSION_COOKIE, session.id))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::seconds(SESSION_TTL_SECS))
        .same_site(axum_extra::extract::cookie::SameSite::Lax);

    Ok((jar.add(cookie), Redirect::temporary("/")))
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
        let _ = state.dynamo.delete_session(&session_id).await;
    }
    let cookie = Cookie::build((SESSION_COOKIE, ""))
        .path("/")
        .max_age(time::Duration::seconds(0));
    Ok((jar.remove(cookie), Json(())))
}

/// Extract session from cookie
pub async fn extract_session(state: &AppState, jar: &CookieJar) -> Result<Session, (StatusCode, String)> {
    let session_id = jar
        .get(SESSION_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let session = state
        .dynamo
        .get_session(&session_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Session lookup failed: {}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "Session not found".to_string()))?;

    let expires_at = chrono::DateTime::parse_from_rfc3339(&session.expires_at)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid session expiry".to_string()))?;
    if Utc::now() > expires_at {
        let _ = state.dynamo.delete_session(&session_id).await;
        return Err((StatusCode::UNAUTHORIZED, "Session expired".to_string()));
    }

    Ok(session)
}

/// Extract user from session cookie
pub async fn extract_user(state: &AppState, jar: &CookieJar) -> Result<User, (StatusCode, String)> {
    let session_id = jar
        .get(SESSION_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let session = state
        .dynamo
        .get_session(&session_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Session lookup failed: {}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "Session not found".to_string()))?;

    // Check expiration
    let expires_at = chrono::DateTime::parse_from_rfc3339(&session.expires_at)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid session expiry".to_string()))?;
    if Utc::now() > expires_at {
        let _ = state.dynamo.delete_session(&session_id).await;
        return Err((StatusCode::UNAUTHORIZED, "Session expired".to_string()));
    }

    state
        .dynamo
        .get_user(&session.user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("User lookup failed: {}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))
}

