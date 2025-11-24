"""
Migration to scope template aliases by project instead of globally
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

def upgrade():
    """
    Upgrade database to support project-scoped template aliases
    """
    # Add project_id column to templates table
    op.add_column('templates', sa.Column('project_id', sa.String(), nullable=True))
    
    # Create index on project_id for performance
    op.create_index('idx_project_id', 'templates', ['project_id'])
    
    # Assign default project_id to existing templates
    # This assumes we can extract project info from existing API keys or use a default
    conn = op.get_bind()
    
    # First, let's assign all existing templates to a default project
    # In a real migration, you might want to extract this from existing data
    conn.execute(
        text("UPDATE templates SET project_id = 'default_project' WHERE project_id IS NULL")
    )
    
    # Make project_id non-nullable after assigning defaults
    op.alter_column('templates', 'project_id', nullable=False)
    
    # Drop the old unique constraint on alias (global uniqueness)
    try:
        op.drop_constraint('templates_alias_key', 'templates', type_='unique')
    except:
        # Constraint might not exist with this name, try to find it
        pass
    
    # Create new composite unique constraint on (alias, project_id)
    op.create_index('idx_alias_project', 'templates', ['alias', 'project_id'], unique=True)
    
    # Create a separate table to track project information if it doesn't exist
    op.create_table(
        'projects',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('NOW()'))
    )
    
    # Insert default project if it doesn't exist
    conn.execute(
        text("""
            INSERT INTO projects (id, name) 
            VALUES ('default_project', 'Default Project')
            ON CONFLICT (id) DO NOTHING
        """)
    )

def downgrade():
    """
    Downgrade database back to global alias uniqueness
    """
    # Remove project-scoped unique constraint
    op.drop_index('idx_alias_project', table_name='templates')
    
    # Add back global unique constraint on alias
    op.create_unique_constraint('templates_alias_key', 'templates', ['alias'])
    
    # Remove project_id column
    op.drop_column('templates', 'project_id')
    
    # Drop projects table
    op.drop_table('projects')