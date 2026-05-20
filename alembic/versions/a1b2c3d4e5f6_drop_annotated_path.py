"""drop annotated_path from images

Revision ID: a1b2c3d4e5f6
Revises: 99407768b86e
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '99407768b86e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('images', 'annotated_path')


def downgrade() -> None:
    op.add_column('images', sa.Column('annotated_path', sa.String(1024), nullable=True))
