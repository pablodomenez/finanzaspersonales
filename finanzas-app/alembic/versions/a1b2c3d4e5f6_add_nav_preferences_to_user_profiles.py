"""add_nav_preferences_to_user_profiles

Revision ID: a1b2c3d4e5f6
Revises: 230f4b5c4bd6
Create Date: 2026-05-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '230f4b5c4bd6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('nav_preferences', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.drop_column('nav_preferences')
