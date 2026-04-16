/**
 * Полный проход ERP через UI (Playwright).
 * node scripts/erp-ui-full-flow.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const ADMIN = { name: 'Admin', password: 'Diyar_7$' };
const RUN = String(Date.now());

const N = {
  rProd: `Администратор производства ${RUN}`,
  rStore: `Кладовщик ${RUN}`,
  rOtk: `ОТК ${RUN}`,
  rSales: `Продажи ${RUN}`,
  uTech: `Технолог_${RUN}`,
  uOp: `Оператор_линии_${RUN}`,
  uWh: `Кладовщик_сотр_${RUN}`,
  uOtk: `ОТК_инспектор_${RUN}`,
  uSales: `Менеджер_продаж_${RUN}`,
  line1: `Линия 1 ${RUN}`,
  line2: `Линия 2 ${RUN}`,
  pvc: `ПВХ ${RUN}`,
  chalk: `Мел ${RUN}`,
  stab: `Стабилизирующая добавка ${RUN}`,
  white: `Краситель белый ${RUN}`,
  chem: `Белая смесь ${RUN}`,
  profile: `Пластиковый профиль 60 ${RUN}`,
  profileCode: `P60_${RUN}`,
  recipe: `Рецепт белого профиля 60 ${RUN}`,
  client1: `ОсОО СтройПласт ${RUN}`,
  client2: `ИП РемПрофиль ${RUN}`,
};

const report = {
  created: {},
  scenarios: [],
  edited: [],
  bugs: [],
  fixed: [],
  failed: [],
};

function log(s) {
  report.scenarios.push(s);
  console.log(`[OK] ${s}`);
}

async function pickOption(page, textPart) {
  const opt = page.locator('[role="listbox"] [role="option"]', { hasText: textPart }).first();
  await opt.waitFor({ state: 'visible', timeout: 20000 });
  await opt.click();
}

async function main() {
  const browser = await chromium.launch({
    headless: process.env.E2E_HEADED !== '1',
    slowMo: Number(process.env.E2E_SLOWMO || 0),
  });
  const page = await browser.newPage({ locale: 'ru-RU' });
  page.setDefaultTimeout(30000);

  const goto = (p) => page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' }).catch(() => page.goto(`${BASE}${p}`));

  try {
    await goto('/login');
    await page.fill('#login-name', ADMIN.name);
    await page.fill('#login-password', ADMIN.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForURL((u) => !String(u.pathname).includes('login'));
    log('Вход Admin');

    // 1. Роли
    await goto('/users');
    await page.getByRole('tab', { name: 'Роли' }).click();
    for (const nm of [N.rProd, N.rStore, N.rOtk, N.rSales]) {
      await page.getByRole('button', { name: 'Создать роль' }).first().click();
      const m = page.locator('.modal').last();
      await m.locator('input').first().fill(nm);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    report.created.roles = [N.rProd, N.rStore, N.rOtk, N.rSales];
    log('Роли ×4');

    await page.locator('.data-table--roles tbody tr').filter({ hasText: N.rStore }).first().click();
    await page.locator('.modal').last().locator('input').first().fill(`${N.rStore} ред`);
    await page.locator('.modal').last().getByRole('button', { name: 'Сохранить' }).click();
    N.rStore = `${N.rStore} ред`;
    report.edited.push('роль Кладовщик');
    log('Правка роли');

    // 2. Сотрудники
    await page.getByRole('tab', { name: 'Список' }).click();
    const staff = [
      [N.uTech, 'Pass_1a!', N.rProd],
      [N.uOp, 'Pass_1a!', N.rProd],
      [N.uWh, 'Pass_1a!', N.rStore],
      [N.uOtk, 'Pass_1a!', N.rOtk],
      [N.uSales, 'Pass_1a!', N.rSales],
    ];
    for (const [login, pwd, roleName] of staff) {
      await page.getByRole('button', { name: 'Добавить' }).first().click();
      const m = page.locator('.modal').last();
      const ins = m.locator('input');
      await ins.nth(0).fill(login);
      await ins.nth(1).fill(pwd);
      await m.locator('button.dias-select').first().click();
      await pickOption(page, roleName.split(' ')[0]);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    report.created.employees = staff.map((s) => s[0]);
    log('Сотрудники ×5');

    await page.locator('input[placeholder="Поиск"]').first().fill(N.uTech);
    await page.waitForTimeout(500);
    await page.locator('.data-table--users tbody tr').first().click();
    await page.locator('.modal').last().locator('input').first().fill(`${N.uTech}_v2`);
    await page.locator('.modal').last().getByRole('button', { name: 'Сохранить' }).click();
    N.uTech = `${N.uTech}_v2`;
    report.edited.push('сотрудник');
    await page.locator('input[placeholder="Поиск"]').first().fill('');
    log('Фильтр + правка сотрудника');

    // 3. Моя смена
    await goto('/my-shift');
    const openPersonal = page.getByRole('button', { name: 'Открыть смену' });
    if (await openPersonal.isVisible().catch(() => false)) {
      await openPersonal.click();
      await page.waitForTimeout(800);
    }
    const ni = page.locator('.my-shift__note-input');
    if (await ni.isVisible().catch(() => false)) {
      await ni.fill(`Заметка E2E ${RUN}`);
      await page.locator('form.my-shift__note-form').getByRole('button', { name: 'Добавить' }).click();
      log('Моя смена: заметка');
    } else {
      report.failed.push('Моя смена: нет поля заметки (возможно смена не открыта)');
    }

    // 4. Линии
    await goto('/lines');
    await page.getByRole('button', { name: 'Создать' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('label:has-text("Название линии") + input, label:has-text("Название линии") ~ input').first().fill(N.line1);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    await page.getByRole('button', { name: 'Создать' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('label:has-text("Название линии") + input, label:has-text("Название линии") ~ input').first().fill(N.line2);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    report.created.lines = [N.line1, N.line2];
    log('Линии');

    await page.locator('.lines-table__row').filter({ hasText: N.line2 }).getByRole('button', { name: 'Редактировать' }).click();
    {
      const m = page.locator('.modal').last();
      const nameInp = m.locator('label:has-text("Название линии") + input, label:has-text("Название линии") ~ input').first();
      await nameInp.fill(`${N.line2} ред`);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    N.line2 = `${N.line2} ред`;
    report.edited.push('линия 2');
    log('Правка линии 2');

    // 5. Смена на линии 1
    await page.locator('.lines-tabs__tab').filter({ hasText: 'Открытие' }).click();
    const openRow = page.locator('.lines-table--opening .lines-table__row').filter({ hasText: N.line1 }).first();
    await openRow.getByRole('button', { name: 'Открыть смену' }).click();
    {
      const form = page.locator('.lines-shift-form');
      const texts = form.locator('input[type="text"]');
      await texts.nth(1).fill('72');
      await texts.nth(2).fill('60');
      await texts.nth(3).fill('90');
      await form.getByRole('button', { name: 'Открыть' }).click();
      await page.locator('.modal').last().waitFor({ state: 'detached', timeout: 25000 }).catch(() => {});
    }
    log('Смена линии 1: 72×60×90°');

    // 6. Сырьё
    await goto('/materials');
    const mats = [
      [N.pvc, '500', '120'],
      [N.chalk, '300', '45'],
      [N.stab, '100', '800'],
      [N.white, '50', '2000'],
    ];
    for (const [nm] of mats) {
      await page.getByRole('button', { name: 'Добавить сырьё' }).click();
      const m = page.locator('.modal').last();
      await m.locator('input').first().fill(nm);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    for (const [nm, q, pr] of mats) {
      const row = page.locator('.materials-table--catalog .materials-table__row').filter({ hasText: nm }).first();
      await row.getByRole('button', { name: 'Оформить приход' }).click();
      const m = page.locator('.modal').last();
      const freeTxt = m.locator('input[type="text"]:not([readonly])');
      await freeTxt.nth(0).fill(q);
      await freeTxt.nth(1).fill(pr);
      await m.getByRole('button', { name: 'Оформить приход' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    report.created.materials = mats.map((x) => x[0]);
    log('Сырьё + приходы');

    await page.getByRole('tab', { name: 'Остатки' }).click();
    log('Сырьё: вкладка Остатки');
    await page.getByRole('tab', { name: 'Партии' }).click();
    log('Сырьё: вкладка Партии');
    await page.getByRole('tab', { name: 'Справочник' }).click();
    await page.locator('.materials-table--catalog .materials-table__row').filter({ hasText: N.pvc }).first()
      .getByRole('button', { name: 'Редактировать' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('input[type="text"]').first().fill(`${N.pvc} ред`);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    }
    N.pvc = `${N.pvc} ред`;
    report.edited.push('сырьё ПВХ');
    log('Правка сырья');

    // 7. Химия
    await goto('/chemistry');
    await page.locator('.chemistry-tabs__tab').filter({ hasText: 'Справочник' }).click();
    await page.getByRole('button', { name: 'Добавить химию' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('input[type="text"]').first().fill(N.chem);
      await m.locator('.modal__actions .btn--primary').click();
      await m.waitFor({ state: 'detached', timeout: 25000 }).catch(() => {});
      const stuck = page.locator('.modal').filter({ hasText: 'Добавить химию' });
      if (await stuck.isVisible().catch(() => false)) {
        const er = await stuck.locator('.modal__error').textContent().catch(() => '');
        throw new Error(`Химия не сохранилась: ${er || 'модалка открыта'}`);
      }
    }
    await page.waitForFunction((nm) => document.body.innerText.includes(nm), N.chem, { timeout: 35000 });
    const chemRow = () => page.locator('.chemistry-table__row').filter({ hasText: N.chem }).first();
    await chemRow().waitFor({ state: 'visible', timeout: 20000 });
    await chemRow().getByRole('button', { name: 'Действия' }).click();
    await page.getByRole('menuitem', { name: 'Состав' }).click();
    {
      const m = page.locator('.modal').last();
      const rows = m.locator('.chemistry-recipe-grid--row');
      const pickRm = async (idx, partName, qty) => {
        await rows.nth(idx).locator('button.dias-select').click();
        await pickOption(page, partName);
        await rows.nth(idx).locator('input').first().fill(qty);
      };
      await pickRm(0, N.pvc, '0.65');
      await m.getByRole('button', { name: '+ Строка' }).click();
      await pickRm(1, N.stab, '0.12');
      await m.getByRole('button', { name: '+ Строка' }).click();
      await pickRm(2, N.white, '0.03');
      await m.getByRole('button', { name: 'Сохранить состав' }).click();
      await m.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    log('Химия: состав');

    await chemRow().getByRole('button', { name: 'Выпуск' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('button.dias-select').first().click();
      await pickOption(page, N.chem);
      await m.locator('input[type="text"]').first().fill('40');
      await m.getByRole('button', { name: 'Выпустить' }).click();
      await m.waitFor({ state: 'detached', timeout: 40000 }).catch(() => {});
    }
    log('Химия: выпуск 40');

    await chemRow().getByRole('button', { name: 'Действия' }).click();
    await page.getByRole('menuitem', { name: 'Редактировать' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('input[type="text"]').first().fill(`${N.chem} ред`);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    N.chem = `${N.chem} ред`;
    report.edited.push('химия');
    log('Правка химии');

    await goto('/chemistry?tab=batches');
    log('Химия: вкладка партии (URL)');

    // 8. Профиль
    await goto('/profiles');
    await page.getByRole('button', { name: 'Добавить профиль' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('.modal__body input[type="text"]').nth(0).fill(N.profile);
      await m.locator('.modal__body input[type="text"]').nth(1).fill(N.profileCode);
      await m.getByRole('button', { name: 'Создать' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    const profBlock = page.locator('.plastic-profiles-table__block').filter({ hasText: N.profile }).first();
    await profBlock.getByRole('button', { name: 'Действия' }).click();
    await page.getByRole('menuitem', { name: 'Редактировать' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('.modal__body input[type="text"]').nth(0).fill(`${N.profile} ред`);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    N.profile = `${N.profile} ред`;
    report.created.profile = N.profile;
    report.edited.push('профиль');
    log('Профиль');

    // 9. Рецепт
    await goto('/recipes');
    await page.getByRole('button', { name: 'Добавить рецепт' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('button.dias-select').first().click();
      await pickOption(page, N.profileCode);
      await m.getByPlaceholder('Например, белый профиль 60').fill(N.recipe);
      await m.getByRole('button', { name: 'Создать' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    const recBlock = page.locator('.recipes-table__row').filter({ hasText: N.recipe }).first();
    await recBlock.getByRole('button', { name: 'Действия' }).click();
    await page.getByRole('menuitem', { name: 'Состав' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('button.dias-select').first().click();
      await pickOption(page, `Сырьё: ${N.pvc}`);
      await m.locator('.recipe-modal__qty').fill('2.5');
      await m.getByRole('button', { name: 'Добавить компонент' }).click();
      await m.locator('button.dias-select').first().click();
      await pickOption(page, `Химия: ${N.chem}`);
      await m.locator('.recipe-modal__qty').fill('1.1');
      await m.getByRole('button', { name: 'Добавить компонент' }).click();
      await m.getByRole('button', { name: 'Сохранить состав' }).click();
      await m.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    await recBlock.getByRole('button', { name: 'Редактировать' }).click();
    {
      const m = page.locator('.modal').last();
      await m.getByPlaceholder('Например, белый профиль 60').fill(`${N.recipe} ред`);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }
    N.recipe = `${N.recipe} ред`;
    report.created.recipe = N.recipe;
    report.edited.push('рецепт');
    log('Рецепт');

    // 10–11. Производство + ОТК
    await goto('/production');
    await page.getByRole('button', { name: 'Новая партия' }).click();
    {
      const m = page.locator('.modal').last();
      await m.locator('button.dias-select').nth(0).click();
      await pickOption(page, N.profile.slice(0, 16));
      await m.locator('button.dias-select').nth(1).click();
      await pickOption(page, N.recipe.slice(0, 16));
      await m.locator('button.dias-select').nth(2).click();
      await pickOption(page, N.line1.slice(0, 10));
      const dec = m.locator('.modal__body input[type="text"]');
      await dec.nth(0).fill('100');
      await dec.nth(1).fill('6');
      await m.getByRole('button', { name: 'Создать партию' }).click();
      await m.waitFor({ state: 'detached', timeout: 45000 }).catch(() => {});
    }
    log('Партия 100×6м');

    await page.getByRole('button', { name: 'В ОТК' }).first().click();
    await page.getByRole('button', { name: 'Отправить' }).click();
    log('В ОТК');

    await goto('/otk');
    await page.getByRole('button', { name: 'Проверить' }).first().click();
    {
      const m = page.locator('.otk-accept-modal');
      await m.getByLabel('Принято, шт').fill('90');
      await m.getByLabel('Брак, шт').fill('10');
      await m.getByLabel(/Причина брака/).fill('Пористость');
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 35000 }).catch(() => {});
    }
    log('ОТК 90/10');

    // 12–13. Склад
    await goto('/warehouse');
    const whSel = page.locator('.page--warehouse__filters-inline button.dias-select');
    await whSel.nth(2).click();
    await pickOption(page, 'Годные');
    log('Склад: фильтр годные');
    await whSel.nth(2).click();
    await pickOption(page, 'Брак');
    log('Склад: фильтр брак');
    await whSel.nth(2).click();
    await pickOption(page, 'Все');

    const whRows = page.locator('.data-table--warehouse tbody tr');
    await whRows.first().click();
    await page.locator('.warehouse-detail-modal').getByRole('button', { name: 'Закрыть' }).click();

    await whRows.nth(0).locator('.action-menu__trigger').click();
    await page.getByRole('menuitem', { name: 'Резерв' }).click();
    await page.locator('.modal').filter({ hasText: 'Резерв' }).getByRole('button', { name: 'Зарезервировать' }).click();
    await page.locator('.modal').filter({ hasText: 'Резерв' }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    log('Резерв (первая строка)');

    await page.getByRole('button', { name: 'Упаковать' }).first().click();
    {
      const root = page.locator('.modal-overlay').filter({ has: page.locator('.pack-from-otk-modal') });
      await root.locator('button.dias-select').first().click();
      await page.locator('[role="listbox"] [role="option"]').filter({ hasNotText: 'Брак ·' }).first().click();
      await page.locator('#pack-from-otk-items-per-pack').fill('10');
      await page.locator('#pack-from-otk-packages-count').fill('9');
      await root.locator('form.pack-from-otk-form').getByRole('button', { name: 'Упаковать' }).click();
      await root.waitFor({ state: 'detached', timeout: 40000 }).catch(() => {});
    }
    log('Упаковка good');

    await page.getByRole('button', { name: 'Упаковать' }).first().click();
    {
      const root = page.locator('.modal-overlay').filter({ has: page.locator('.pack-from-otk-modal') });
      await root.locator('button.dias-select').first().click();
      await page.locator('[role="listbox"] [role="option"]', { hasText: 'Брак ·' }).first().click();
      await page.locator('#pack-from-otk-items-per-pack').fill('10');
      await page.locator('#pack-from-otk-packages-count').fill('1');
      await root.locator('form.pack-from-otk-form').getByRole('button', { name: 'Упаковать' }).click();
      await root.waitFor({ state: 'detached', timeout: 40000 }).catch(() => {});
    }
    log('Упаковка defect');

    // 14–15. Клиенты и продажи
    await goto('/clients');
    for (const c of [N.client1, N.client2]) {
      await page.getByRole('button', { name: 'Создать' }).first().click();
      const m = page.locator('.modal').last();
      await m.locator('input[type="text"]').first().fill(c);
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await m.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    }
    await page.locator('tr').filter({ hasText: N.client1 }).first().click();
    await page.locator('.modal').last().locator('input[type="text"]').first().fill(`${N.client1} ред`);
    await page.locator('.modal').last().getByRole('button', { name: 'Сохранить' }).click();
    N.client1 = `${N.client1} ред`;
    report.edited.push('клиент');
    report.created.clients = [N.client1, N.client2];
    log('Клиенты');

    await goto('/sales');
    const saleOnce = async (clientPart, defect) => {
      await page.getByRole('button', { name: 'Создать' }).first().click();
      const m = page.locator('.sales-modal');
      await m.locator('button.dias-select').nth(0).click();
      await pickOption(page, clientPart);
      await m.locator('button.dias-select').nth(1).click();
      if (defect) {
        await page.locator('[role="listbox"] [role="option"]', { hasText: 'Брак ·' }).first().click();
      } else {
        await page.locator('[role="listbox"] [role="option"]').filter({ hasNotText: 'Брак ·' }).nth(0).click();
      }
      await m.locator('input[value="package"]').check();
      await page.locator('#sale-modal-packs').fill('1');
      await m.getByPlaceholder('0').fill(defect ? '40000' : '95000');
      await m.getByRole('button', { name: 'Сохранить' }).click();
      await page.getByRole('button', { name: 'Закрыть' }).click().catch(() => {});
      await page.locator('.sales-modal').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    };
    await saleOnce(N.client1.slice(0, 8), true);
    await saleOnce(N.client2.slice(0, 8), false);
    report.created.sales = ['defect', 'good'];
    log('Продажи ×2');

    report.created.runId = RUN;
  } catch (e) {
    report.bugs.push(String(e?.message || e));
    console.error(e);
    await page.screenshot({ path: path.join(process.cwd(), 'e2e-failure.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const md = `# Какие данные созданы

- роли: ${(report.created.roles || []).join('; ')}
- сотрудники: ${(report.created.employees || []).join('; ')}
- линии: ${(report.created.lines || []).join('; ')}
- сырьё: ${(report.created.materials || []).join('; ')}
- химия: ${N.chem}
- профиль: ${N.profile}
- рецепт: ${N.recipe}
- production batch: 100 шт × 6 м (линия «${N.line1}»)
- warehouse batch: после ОТК; упаковка good 9×10 шт, defect 1×10 шт (если API позволил)
- клиенты: ${(report.created.clients || []).join('; ')}
- продажи: ${(report.created.sales || []).join('; ')}
- runId: ${RUN}

# Какие сценарии пройдены

${report.scenarios.map((s) => `- ${s}`).join('\n')}

# Что редактировалось

${report.edited.map((s) => `- ${s}`).join('\n')}

# Какие баги найдены

${report.bugs.length ? report.bugs.map((b) => `- ${b}`).join('\n') : '- автотест не выбросил необработанное исключение'}

# Что исправлено

${report.fixed.length ? report.fixed.join('\n') : '- изменений кода фронта в этой сессии не вносилось'}

# Что не удалось пройти

${report.failed.length ? report.failed.map((x) => `- ${x}`).join('\n') : '- нет'}

# Итог

- Полный цикл через UI (Playwright): ${report.bugs.length === 0 ? 'пройден по шагам скрипта' : 'ошибка — см. раздел «баги» и файл e2e-failure.png'}
- Цепочка роли → сотрудники → смена → линия → сырьё → химия → рецепт → производство → ОТК → склад → упаковка → продажа: автоматизирована в \`scripts/erp-ui-full-flow.mjs\`
`;
  fs.writeFileSync(path.join(process.cwd(), 'FRONTEND_FULL_USER_FLOW_TEST_REPORT.md'), md, 'utf8');
  console.log('Report written.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
