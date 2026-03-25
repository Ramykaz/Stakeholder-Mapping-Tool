from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0016_alter_entityreviewcandidate_similarity_score'),
    ]

    operations = [
        migrations.AddField(
            model_name='entity',
            name='is_flagged',
            field=models.BooleanField(default=False, db_index=True),
        ),
    ]
