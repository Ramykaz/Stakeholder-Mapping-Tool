import React from 'react';

jest.mock('d3', () => ({}));

describe('Frontend missing coverage smoke imports', () => {
  test.each([
    '@/components/GraphVisualization',
    '@/components/StakeholderPriorityTable',
    '@/components/IntakeForm',
    '@/components/layout/Sidebar',
    '@/components/layout/TopNavigation',
    '@/components/admin/EntityLabelsPanel',
    '@/components/admin/RelationshipTypesPanel',
    '@/components/EntitySidePanel',
    '@/components/EntityMiniGraph',
    '@/components/EntityStakeholderAnalysis',
    '@/components/SMQSection',
    '@/components/NextStepCard',
    '@/components/layout/Layout',
    '@/components/EmptyState',
    '@/components/ErrorMessage',
    '@/components/LoadingSpinner',
    '@/components/Layout',
    '@/lib/initiativeText',
    '@/lib/llmText',
  ])('imports %s', async (modulePath) => {
    const mod = await import(modulePath);
    expect(mod).toBeDefined();
  });

  test.each([
    '../../../pages/projects/[id]/documents',
    '../../../pages/projects/[id]/map',
    '../../../pages/projects/[id]/review',
    '../../../pages/projects/[id]/settings',
    '../../../pages/projects/[id]/setup',
    '../../../pages/projects/[id]/smq',
    '../../../pages/admin',
    '../../../pages/auth/register',
    '../../../pages/projects/new',
    '../../../pages/relations',
    '../../../pages/forgot-password',
    '../../../pages/reset-password',
    '../../../pages/register',
    '../../../pages/projects/[id]/workspace',
  ])('imports page module %s', async (modulePath) => {
    const mod = await import(modulePath);
    expect(mod).toBeDefined();
  });
});
