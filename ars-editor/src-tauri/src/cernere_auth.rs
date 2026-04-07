//! Cernere JWT 認証ミドルウェア
//!
//! Cernere が発行した JWT を検証し、ユーザー情報を抽出する。
//! GitHub OAuth フローは Cernere が担当するため、
//! このサービスは JWT の検証のみ行う。

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

use crate::app_state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: String,   // user ID
    pub role: String,
    pub iat: usize,
    pub exp: usize,
}

#[derive(Debug, Serialize)]
pub struct AuthUser {
    pub id: String,
    pub role: String,
}

/// JWT を Bearer ヘッダーから抽出・検証
pub async fn extract_user_from_jwt(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<AuthUser, (StatusCode, String)> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "No Authorization header".into()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err((StatusCode::UNAUTHORIZED, "Invalid Authorization header".into()));
    }

    let token = &auth_header[7..];
    let secret = state.jwt_secret().await;

    let token_data = decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid token: {}", e)))?;

    Ok(AuthUser {
        id: token_data.claims.sub,
        role: token_data.claims.role,
    })
}

/// GET /auth/me — Cernere JWT から現在のユーザー情報を返す
pub async fn get_me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<AuthUser>, (StatusCode, String)> {
    let user = extract_user_from_jwt(&state, &headers).await?;
    Ok(Json(user))
}
