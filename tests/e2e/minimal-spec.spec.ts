import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, nav, signIn } from './helpers';
import { essentialQuestionIds } from '../../packages/shared/src/essentials';

/**
 * The minimal path to a correct specification, in the browser: a project created at the essentials
 * level from one sentence, 15 required answers instead of 60, one action to review and approve, and the
 * tasks already on the board.
 */
test.use({ reducedMotion: 'reduce' });

/** The signed-in browser's own API calls, so the journey need not type 15 answers by hand. */
const call = (page: Page, method: string, path: string, body?: unknown) =>
  page.evaluate(
    async ([method, path, body]) => {
      const response = await fetch(`/api/v1${path}`, {
        method: method as string,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      return response.json();
    },
    [method, path, body] as const,
  );
/**
 * The project by its (unique) name. The address still shows the previously open project for a moment
 * after the dialog closes, so reading it there would sometimes find the wrong one.
 */
async function projectNamed(page: Page, name: string) {
  let id = '';
  await expect
    .poll(async () => {
      const list = await call(page, 'GET', '/projects');
      id =
        ((Array.isArray(list) ? list : list.projects) as { id: string; name: string }[]).find(
          (p) => p.name === name,
        )?.id ?? '';
      return id;
    })
    .not.toBe('');
  return id;
}

test('creates an essentials project from one sentence, and reaches approved tasks in one action', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio', { name: /Essentials/ })).toBeChecked();
  await expect(dialog.getByText('Essentials asks 15 core questions')).toBeVisible();
  await expectAccessible(page, 'New project dialog with the level choice', '[role="dialog"]');
  const name = `Minimal ${Date.now()}`;
  await dialog.getByLabel('Project name').fill(name);
  await dialog
    .getByLabel(/What are you building/)
    .fill('A portal where customers follow their service requests.');
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog).toBeHidden();
  await expect(nav(page).getByRole('button', { name: 'Build with AI' })).toHaveClass(/active/);
  // The draft is asked for, or the person is told why not; either way the project exists.
  await expect(
    page.getByRole('status').filter({ hasText: /essential answers|No draft/ }),
  ).toBeVisible();

  // Essentials asks 2 questions in the first section instead of 6.
  const documentPane = page.getByRole('region', { name: 'Document' });
  await expect(documentPane.getByRole('button', { name: /^Business & discovery/ })).toContainText(
    '0 of 2',
  );

  // Fill the 15 answers and a tested requirement the way a person or an agent would.
  const id = await projectNamed(page, name);
  const spec = (await call(page, 'GET', `/projects/${id}`)).spec;
  expect(spec.level).toBe('essentials');
  const sections = new Map<string, Record<string, unknown>>();
  for (const question of essentialQuestionIds)
    sections.set(question.split('.')[0], {
      ...(sections.get(question.split('.')[0]) ?? {}),
      [question]: { value: `Answer to ${question}`, state: 'answered', reason: '' },
    });
  const saved = await call(page, 'PATCH', `/projects/${id}`, {
    expectedRevision: spec.revision,
    patch: {
      sections: [...sections].map(([section, answers]) => ({ id: section, answers })),
      items: [
        {
          id: 'REQ-001',
          type: 'requirement',
          title: 'Customers sign in',
          status: 'accepted',
          acceptance: 'Sign-in takes under 2 seconds',
        },
        { id: 'TEST-001', type: 'test', title: 'Sign-in timing test', status: 'accepted' },
      ],
      links: [{ id: 'LINK-001', from: 'TEST-001', to: 'REQ-001', kind: 'tests' }],
    },
  });
  expect(saved.revision).toBeGreaterThan(spec.revision);
  await page.reload();

  // Readiness: only the nine sections with an essential question need a review, and one action does the rest.
  await nav(page)
    .getByRole('button', { name: /Readiness/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Not ready yet' })).toBeVisible();
  await expect(page.getByText('0/9')).toBeVisible();
  const table = page.getByRole('region', { name: 'Section reviews table' });
  await expect(table.getByText('Not required')).toHaveCount(5);
  await expectAccessible(page, 'Readiness at the essentials level');
  await page.getByRole('button', { name: 'Review all and approve' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Baseline approved' })).toContainText(
    '2 tasks were created on the board',
  );
  await expect(page.getByRole('heading', { name: 'Ready for baseline approval' })).toBeVisible();
  await expect(page.getByText('9/9')).toBeVisible();

  // The tasks are already on the board, with what the plan found missing.
  await page.keyboard.press('Alt+8');
  await expect(page.getByRole('heading', { name: 'Implementation board', level: 1 })).toBeVisible();
  const todo = page.getByRole('region', { name: /^To do/ });
  await expect(todo.locator('.kanban-card')).toHaveCount(2);
  await expect(
    page.getByRole('heading', { name: 'Gaps the task plan found in the specification' }),
  ).toBeVisible();
  await expect(page.getByText('REQ-001 is not implemented by any component.')).toBeVisible();
  await expectAccessible(page, 'Board with the plan gaps');
});

test('shows the level in Settings and keeps every answer when switching to complete', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  const name = `Level ${Date.now()}`;
  await dialog.getByLabel('Project name').fill(name);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog).toBeHidden();
  const id = await projectNamed(page, name);
  const current = (await call(page, 'GET', `/projects/${id}`)).spec;
  const answered = await call(page, 'PATCH', `/projects/${id}`, {
    expectedRevision: current.revision,
    patch: {
      sections: [
        {
          id: 'discovery',
          answers: {
            'discovery.1': { value: 'Support loses requests.', state: 'answered', reason: '' },
          },
        },
      ],
    },
  });
  expect(answered.revision).toBe(current.revision + 1);
  // The page still holds the earlier revision; saving a setting from it would be a conflict, so start from the latest.
  await page.reload();
  await page
    .getByRole('complementary', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Project', exact: true }).click();
  const level = page.getByLabel('How much to specify');
  await expect(level).toHaveValue('essentials');
  await level.selectOption('complete');
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project settings saved.' }),
  ).toBeVisible();
  await expect
    .poll(async () => (await call(page, 'GET', `/projects/${id}`)).spec.level)
    .toBe('complete');
  const after = (await call(page, 'GET', `/projects/${id}`)).spec;
  expect(after.sections[0].answers['discovery.1'].value).toBe('Support loses requests.');
  await expectAccessible(page, 'Settings with the level');
});
