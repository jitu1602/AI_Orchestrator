import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the shopping cart page.
 *
 * Same conventions as the other page objects: public getters, semantic locators,
 * spec-callable methods, no hardcoded credentials or brittle attribute selectors.
 */
export class CartPage {
  constructor(private readonly page: Page) {}

  /** The line items currently in the cart. */
  public get cartItems(): Locator {
    return this.page.locator('.cart_item');
  }

  /** The button that starts the checkout flow. */
  public get checkoutButton(): Locator {
    return this.page.getByRole('button', { name: /checkout/i });
  }

  /** The button that returns to the inventory listing. */
  public get continueShoppingButton(): Locator {
    return this.page.getByRole('button', { name: /continue shopping/i });
  }

  /** Count of line items in the cart. */
  public async itemCount(): Promise<number> {
    return this.cartItems.count();
  }

  /** True if a product with the given (case-insensitive) name is in the cart. */
  public async hasItem(name: string): Promise<boolean> {
    return (await this.cartItems.filter({ hasText: new RegExp(name, 'i') }).count()) > 0;
  }

  /** Remove the first line item from the cart. */
  public async removeFirstItem(): Promise<void> {
    await this.cartItems
      .first()
      .getByRole('button', { name: /remove/i })
      .click();
  }
}
