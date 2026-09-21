from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Application Config
    APP_NAME: str = "Fraud Investigation System"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # SQLite Database Config
    DATABASE_URL: str = "sqlite:///./app/database/fraud.db"
    
    # TigerGraph Credentials & Endpoint Settings
    TIGERGRAPH_HOST: str = "https://tg-6e22da4d-d8bd-479a-9705-85af88dd8a0e.tg-2635877100.i.tgcloud.io"
    TIGERGRAPH_GRAPH_NAME: str = "FraudGraph"
    TIGERGRAPH_SECRET: Optional[str] = None
    TIGERGRAPH_TOKEN: Optional[str] = None
    TIGERGRAPH_USERNAME: Optional[str] = None
    TIGERGRAPH_PASSWORD: Optional[str] = None
    
    # AI / LLM Configuration
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    OPENAI_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4o"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
