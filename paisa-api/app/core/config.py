from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Paisa"
    env: str = "local"
    log_level: str = "INFO"

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "paisa"

    jwt_secret: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    cors_origins: list[str] = ["http://localhost:5173"]
    max_upload_mb: int = 20
    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-001"
    embedding_dims: int = 1536

    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = ""
    azure_api_version: str = "2024-10-21"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
