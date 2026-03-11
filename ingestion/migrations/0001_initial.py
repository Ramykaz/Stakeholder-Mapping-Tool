"""Initial migration: create Document and Chunk tables with pgvector index."""
import uuid
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models
from pgvector.django import VectorExtension


class Migration(migrations.Migration):

    initial = True
    dependencies = []

    operations = [
        # Enable the pgvector extension in PostgreSQL.
        VectorExtension(),

        migrations.CreateModel(
            name='Document',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('filename', models.CharField(max_length=255)),
                ('file_format', models.CharField(
                    choices=[('pdf', 'PDF'), ('docx', 'DOCX'), ('txt', 'TXT')],
                    max_length=10,
                )),
                ('upload_timestamp', models.DateTimeField(auto_now_add=True)),
                ('processing_status', models.CharField(
                    choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed')],
                    default='pending',
                    max_length=20,
                )),
                ('chunk_count', models.IntegerField(blank=True, null=True)),
            ],
            options={'db_table': 'ingestion_documents'},
        ),

        migrations.CreateModel(
            name='Chunk',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('document', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='chunks',
                    to='ingestion.document',
                )),
                ('text', models.TextField()),
                # VectorField stores a 384-dimensional float vector.
                # pgvector extension must be enabled (handled by VectorExtension above).
                ('embedding', models.Field(db_column='embedding')),  # placeholder; overridden below
                ('chunk_index', models.IntegerField()),
                ('token_count', models.IntegerField()),
            ],
            options={
                'db_table': 'ingestion_chunks',
                'unique_together': {('document', 'chunk_index')},
            },
        ),

        # Use raw SQL for the VectorField column and IVFFlat index,
        # since Django migrations represent it as a plain Field above.
        migrations.RunSQL(
            sql="""
                ALTER TABLE ingestion_chunks
                    DROP COLUMN IF EXISTS embedding,
                    ADD COLUMN embedding vector(384) NOT NULL;

                CREATE INDEX chunk_embedding_idx
                    ON ingestion_chunks
                    USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 100);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS chunk_embedding_idx;
                ALTER TABLE ingestion_chunks DROP COLUMN IF EXISTS embedding;
                ALTER TABLE ingestion_chunks ADD COLUMN embedding text;
            """,
        ),
    ]
