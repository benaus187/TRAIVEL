from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    supabase_url: str
    supabase_service_key: str
    google_places_api_key: str = ""
    youtube_api_key: str = ""
    allowed_origins: str = "http://localhost:3000"
    manager_emails: str = ""
    frontend_url: str = "http://localhost:3000"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id_monthly: str = ""
    stripe_price_id_annual: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
