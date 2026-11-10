import { expect, test, type Locator, type Page } from '@playwright/test';
import { chooseComplete, expectAccessible, nav, signIn } from './helpers';
import { createSpec } from '../../packages/shared/src/domain';
import { findQuestion, modules, moduleQuestions, type Question } from '../../packages/shared/src/templates';

/**
 * The specification as a conversation: one question at a time as a card, answered with the control
 * that fits it, saved at once into the document beside it. Needs no AI; the AI joins when asked.
 */
// Motion is off in these journeys: colours are checked settled, and the assistant answers without pauses.
test.use({ reducedMotion: 'reduce' });

const reference = createSpec('00000000-0000-4000-8000-0000000000aa', 'Reference', 'en', false, 'Web application');
const questions = modules.flatMap((m) => moduleQuestions(m, reference));
const ofKind = (kind: Question['kind']) => questions.find((q) => q.kind === kind && q.required) ?? questions.find((q) => q.kind === kind)!;
const prompt = (id: string) => findQuestion(id)!.prompt.en;
const sectionTitle = (q: Question) => modules.find((m) => m.id === q.id.split('.')[0])!.title.en;

const conversation = (page: Page) => page.getByRole('region', { name: 'Conversation' });
const documentPane = (page: Page) => page.getByRole('region', { name: 'Document' });
const card = (page: Page, id: string) => conversation(page).getByRole('textbox', { name: prompt(id) });
const progress = (page: Page, title: string) => documentPane(page).getByRole('button', { name: new RegExp(`^${title}`) });

async function newProject(page: Page, name: string) {
  await signIn(page);
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill(`${name} ${Date.now()}`);
  // The questions this journey walks through (stakeholders, business goals…) are required at the complete level.
  await chooseComplete(dialog);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(nav(page).getByRole('button', { name: 'Build with AI' })).toHaveClass(/active/);
  await expect(card(page, 'discovery.1')).toBeVisible();
}
/** Opens a question of another section in the conversation from the document. */
async function answerInChat(page: Page, q: Question) {
  const head = progress(page, sectionTitle(q));
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
  // A label can repeat, even within a section: count the ones before this question and pick the same one.
  const sectionId = q.id.split('.')[0];
  const before = questions.filter((x) => x.id.startsWith(`${sectionId}.`) && x.label.en === q.label.en && questions.indexOf(x) < questions.indexOf(q)).length;
  await documentPane(page).locator(`#live-panel-${sectionId}`).getByRole('button', { name: new RegExp(`^Answer in chat: ${q.label.en}$`) }).nth(before).click();
  // The question arrives as a card, without a canned introduction (TASK-154).
  await expect(openCards(page).last()).toContainText(q.prompt.en);
}
const openCards = (page: Page): Locator => conversation(page).locator('.builder-card:not(.answered)');

test('asks the questions one at a time and saves each answer into the document at once', async ({ page }) => {
  await newProject(page, 'Interview');
  await expect(conversation(page)).toContainText('I’ll guide you through your design document');
  await expect(conversation(page)).toContainText('Let’s work on Business & discovery');
  await expect(progress(page, 'Business & discovery')).toContainText('0 of');
  await expectAccessible(page, 'Guided interview, first question');

  // Answer with Enter: the answer is in the document immediately, and the next question is focused.
  await card(page, 'discovery.1').fill('Support agents lose customer requests in long email threads.');
  await card(page, 'discovery.1').press('Enter');
  await expect(conversation(page).getByText('Support agents lose customer requests in long email threads.')).toBeVisible();
  await expect(conversation(page)).toContainText(/Got it\.|Noted\.|Thanks\.|Perfect\.|Great\./);
  await expect(card(page, 'discovery.2')).toBeFocused();
  await expect(progress(page, 'Business & discovery')).toContainText('1 of');
  await expect(documentPane(page)).toContainText('Support agents lose customer requests in long email threads.');
  await expect(openCards(page)).toHaveCount(1);

  // Shift+Enter writes a new line instead of sending.
  await card(page, 'discovery.2').fill('Faster replies');
  await card(page, 'discovery.2').press('Shift+Enter');
  await page.keyboard.type('Fewer lost requests');
  await expect(card(page, 'discovery.2')).toHaveValue('Faster replies\nFewer lost requests');
  await conversation(page).getByRole('button', { name: 'Skip for now' }).click();
  await expect(conversation(page).getByText('Skipped for now')).toBeVisible();
  await expect(conversation(page)).toContainText('I’ll come back to it later.');

  // A table opens in a dialog.
  await conversation(page).getByRole('button', { name: 'Fill in the table' }).click();
  const dialog = page.getByRole('dialog');
  await expectAccessible(page, 'Guided interview, table dialog');
  await dialog.getByRole('textbox', { name: 'Stakeholder 1' }).fill('Head of support');
  await dialog.getByRole('textbox', { name: 'Decision rights 1' }).fill('Approves the scope');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(conversation(page).getByText('1 row')).toBeVisible();

  // Not sure yet, and does not apply (with a reason).
  await expect(card(page, 'discovery.4')).toBeVisible();
  await conversation(page).getByRole('button', { name: 'Not sure yet' }).click();
  await expect(conversation(page).getByText('Unknown for now', { exact: true })).toBeVisible();
  await expect(conversation(page)).toContainText('Marked as unknown for now');
  await expect(openCards(page)).toHaveCount(1);
  await conversation(page).getByRole('button', { name: 'Doesn’t apply' }).click();
  await conversation(page).getByRole('textbox', { name: 'Why does this not apply?' }).fill('Internal tool with no revenue model');
  await conversation(page).getByRole('button', { name: 'Confirm' }).click();
  await expect(conversation(page).getByText('Does not apply: Internal tool with no revenue model')).toBeVisible();
  await expect(progress(page, 'Business & discovery')).toContainText('3 of');
  await expectAccessible(page, 'Guided interview, answered questions');

  // The conversation and the answers survive a reload; the open question comes back.
  await page.reload();
  await expect(conversation(page)).toContainText('Support agents lose customer requests in long email threads.');
  await expect(conversation(page)).toContainText('Welcome back');
  await expect(openCards(page)).toHaveCount(1);
  await expect(progress(page, 'Business & discovery')).toContainText('3 of');

  // A new conversation starts over, but what was answered stays answered.
  await page.getByRole('button', { name: 'New conversation' }).click();
  await expect(conversation(page)).toContainText('I’ll guide you through your design document');
  await expect(conversation(page).getByText('Welcome back')).toHaveCount(0);
  await expect(progress(page, 'Business & discovery')).toContainText('3 of');
});

test('answers with the control that fits each question', async ({ page }) => {
  await newProject(page, 'Controls');

  const choice = ofKind('choice');
  await answerInChat(page, choice);
  await conversation(page).getByRole('button', { name: choice.options![1].en, exact: true }).click();
  await expect(conversation(page).getByText(choice.options![1].en, { exact: true })).toBeVisible();

  const toggle = ofKind('switch');
  await answerInChat(page, toggle);
  await conversation(page).getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(conversation(page).getByText('Yes', { exact: true })).toBeVisible();

  const multi = ofKind('multi');
  await answerInChat(page, multi);
  await expect(conversation(page).getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await conversation(page).getByLabel(multi.options![0].en).check();
  await conversation(page).getByLabel(multi.options![1].en).check();
  await conversation(page).getByRole('button', { name: 'Send', exact: true }).click();
  await expect(conversation(page).getByText(`${multi.options![0].en}, ${multi.options![1].en}`)).toBeVisible();

  const slider = ofKind('slider');
  await answerInChat(page, slider);
  await conversation(page).getByRole('spinbutton').fill(String(slider.range!.min + slider.range!.step * 4));
  await conversation(page).getByRole('button', { name: 'Send', exact: true }).click();
  await expect(conversation(page).getByText(new RegExp(`^${slider.range!.min + slider.range!.step * 4}`))).toBeVisible();

  const grid = ofKind('matrix');
  await answerInChat(page, grid);
  await conversation(page).getByRole('radio', { name: `${grid.rows![0].en}: ${grid.options![0].en}` }).check();
  await conversation(page).getByRole('button', { name: 'Send', exact: true }).click();
  await expect(conversation(page).getByText('1 rows')).toBeVisible();

  // The answers are in the document (the section of the last question is open), and the cards were accessible.
  await expect(documentPane(page)).toContainText('1 rows');
  await expectAccessible(page, 'Guided interview, controls');
});

test('closes the question that was left open when the person goes elsewhere, and parks it on "next question"', async ({ page }) => {
  await newProject(page, 'Moving');
  const security = questions.find((q) => q.id.startsWith('security.') && q.kind === 'text')!;
  await answerInChat(page, security);
  await expect(conversation(page).getByRole('textbox', { name: security.prompt.en })).toBeVisible();
  // The question that was open before is folded quietly, so only one stays open; going elsewhere is not a skip.
  await expect(openCards(page)).toHaveCount(1);
  await expect(conversation(page).getByText('Skipped for now')).toHaveCount(0);

  // "Next question" moves on and sets the open one aside as skipped.
  await conversation(page).getByRole('button', { name: 'Next question', exact: true }).click();
  await expect(conversation(page).getByText('Skipped for now')).toBeVisible();
  await expect(openCards(page)).toHaveCount(1);
  await expect(conversation(page).getByRole('textbox', { name: security.prompt.en })).toHaveCount(0);
});

test('suggests an answer with the AI as a proposal, never a direct change', async ({ page }) => {
  await newProject(page, 'Suggest');
  await conversation(page).getByRole('button', { name: 'Suggest with AI' }).click();
  await expect(conversation(page).getByText('Asked the AI for a suggestion')).toBeVisible();
  const proposal = conversation(page).locator('.builder-card').filter({ has: page.getByRole('heading', { name: 'Suggested answer', exact: true }) });
  await expect(proposal).toContainText('waiting for review');
  await expect(progress(page, 'Business & discovery')).toContainText('0 of');
  await proposal.getByRole('button', { name: 'Accept' }).click();
  await expect(proposal).toContainText('accepted');
  await expect(progress(page, 'Business & discovery')).toContainText('1 of');
  await expect(documentPane(page)).toContainText('Answer every customer request within one business day.');
});

test('keeps guiding when no AI is set up', async ({ page }) => {
  await page.route('**/api/v1/integrations', (route) => route.fulfill({ json: [] }));
  await newProject(page, 'No AI');
  await expect(page.getByText('Guided questions only')).toBeVisible();
  await expect(conversation(page)).not.toContainText('ask the AI for a suggestion');
  await expect(conversation(page).getByRole('button', { name: 'Suggest with AI' })).toHaveCount(0);
  // Typing to the AI gets a plain answer, and the interview carries on.
  const input = conversation(page).getByPlaceholder('Next question…');
  await input.fill('Can you write this for me?');
  await input.press('Enter');
  await expect(conversation(page)).toContainText('The AI isn’t available here');
  await card(page, 'discovery.1').fill('Requests get lost');
  await card(page, 'discovery.1').press('Enter');
  await expect(progress(page, 'Business & discovery')).toContainText('1 of');
  await expectAccessible(page, 'Guided interview without AI');
});

test('speaks French when the interface does', async ({ page }) => {
  await newProject(page, 'Français');
  await page.getByLabel('Interface language').selectOption('fr');
  // Questions asked after the switch come in French, with French controls.
  await page.getByRole('button', { name: 'Construire avec l’IA' }).waitFor();
  await documentPane(page).getByRole('button', { name: new RegExp(`^${modules[0].title.fr}`) }).first().waitFor();
  const jump = documentPane(page).getByRole('button', { name: /^Répondre dans le chat/ }).first();
  await jump.click();
  await expect(openCards(page)).toHaveCount(1);
  await expect(conversation(page).getByRole('button', { name: 'Passer pour l’instant' })).toBeVisible();
  await expect(conversation(page).getByRole('button', { name: 'Pas encore sûr' })).toBeVisible();
  await expectAccessible(page, 'Interview guidée en français');
});
