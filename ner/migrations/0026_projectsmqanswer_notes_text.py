from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0025_workplan'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectsmqanswer',
            name='notes_text',
            field=models.TextField(blank=True, default=''),
        ),
    ]
