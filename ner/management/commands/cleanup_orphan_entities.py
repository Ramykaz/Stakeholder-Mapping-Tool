from django.core.management.base import BaseCommand
from ner.services.pipeline import cleanup_orphan_entities


class Command(BaseCommand):
    help = 'Delete project-scoped entities that have zero mention evidence records.'

    def add_arguments(self, parser):
        parser.add_argument('--project-id', dest='project_id', default='', help='Optional project UUID filter')

    def handle(self, *args, **options):
        project_id = (options.get('project_id') or '').strip()
        result = cleanup_orphan_entities(project_id=project_id or None)
        if result['matched_entities'] == 0:
            self.stdout.write(self.style.SUCCESS('No orphan entities found.'))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {result['deleted_records']} orphan entity records (matched entities: {result['matched_entities']})."
            )
        )
