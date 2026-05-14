from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://cvr:cvr@db:5432/cvr"
    storage_dir: Path = Path("/app/storage")

    @property
    def base_dir(self) -> Path:
        return self.storage_dir / "base"

    @property
    def captures_dir(self) -> Path:
        return self.storage_dir / "captures"

    @property
    def annotated_dir(self) -> Path:
        return self.storage_dir / "annotated"


settings = Settings()
