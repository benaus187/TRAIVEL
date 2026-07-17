from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    supabase_url: str
    supabase_service_key: str
    google_places_api_key: str = ""
    x_bearer_token: str = ""
    allowed_origins: str = "http://localhost:3000"

    model_config = {"env_file": ".env"}


settings = Settings()
