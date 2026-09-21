from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Application Config
    APP_NAME: str = "Fraud Investigation System"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # SQLite Database Config
    DATABASE_URL: str = "sqlite:///./app/database/fraud.db"
    
    # TigerGraph Settings
    TIGERGRAPH_HOST: str = "https://your-tigergraph-instance.cloud.tigergraph.com"
    TIGERGRAPH_TOKEN: Optional[str] = "your-tigergraph-restpp-token"
    TIGERGRAPH_GRAPH_NAME: str = "FraudGraph"
    TIGERGRAPH_USERNAME: str = "tigergraph"
    TIGERGRAPH_PASSWORD: str = "tigergraph"
    
    # AI / LLM Configuration
    OPENAI_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4o"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
