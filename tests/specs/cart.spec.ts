import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InventoryPage } from '../pages/InventoryPage';
import { CartPage } from '../pages/CartPage';

/**
 * Cart flow spec — demonstrates a multi-page flow with an automated login
 * precondition (never assumed to carry over from another test).
 *
 * Traces to: REQ-003 (add product to cart), REQ-004 (cart reflects added items),
 *            REQ-005 (remove product from cart).
 */
test.describe('Shopping cart', () => {
  // Precondition for every test: log in and confirm we landed on inventory.
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(process.env.USERNAME ?? '', process.env.PASSWORD ?? '');
    await expect(page).toHaveURL(/inventory/i);
  });

  test('TC-004: Verify adding a product increments the cart badge count', async ({ page }) => {
    const inventory = new InventoryPage(page);

    expect(await inventory.cartCount()).toBe(0);
    await inventory.addFirstItemToCart();

    expect(await inventory.cartCount()).toBe(1);
  });

  test('TC-005: Verify an added product appears on the cart page', async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.addFirstItemToCart();
    await inventory.goToCart();

    const cart = new CartPage(page);
    await expect(page).toHaveURL(/cart/i);
    expect(await cart.itemCount()).toBe(1);
  });

  test('TC-006: Verify removing a product empties the cart', async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.addFirstItemToCart();
    await inventory.goToCart();

    const cart = new CartPage(page);
    expect(await cart.itemCount()).toBe(1);

    await cart.removeFirstItem();
    expect(await cart.itemCount()).toBe(0);
  });
});
