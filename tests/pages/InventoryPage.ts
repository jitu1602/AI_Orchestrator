import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the product inventory / listing page (post-login landing).
 *
 * Follows the same conventions as LoginPage: public getters, semantic locators
 * (role/name first), no hardcoded app-specific attribute selectors, methods that
 * a spec can call directly.
 */
export class InventoryPage {
  constructor(private readonly page: Page) {}

  /** The list of product cards on the page. */
  public get items(): Locator {
    return this.page.locator('.inventory_item');
  }

  /** The shopping-cart link/badge in the header. */
  public get cartLink(): Locator {
    return this.page.locator('.shopping_cart_link');
  }

  /** The numeric badge showing how many items are in the cart (absent when empty). */
  public get cartBadge(): Locator {
    return this.page.locator('.shopping_cart_badge');
  }

  /** True once the inventory list is visible — a reliable "we're logged in" signal. */
  public async isLoaded(): Promise<boolean> {
    return this.items.first().isVisible();
  }

  /** Add the first product to the cart via its "Add to cart" button. */
  public async addFirstItemToCart(): Promise<void> {
    await this.items
      .first()
      .getByRole('button', { name: /add to cart/i })
      .click();
  }

  /** Read the cart badge count as a number (0 when the badge is absent). */
  public async cartCount(): Promise<number> {
    if (!(await this.cartBadge.isVisible())) {
      return 0;
    }
    const text = (await this.cartBadge.textContent())?.trim() ?? '0';
    return Number.parseInt(text, 10) || 0;
  }

  /** Navigate to the cart page. */
  public async goToCart(): Promise<void> {
    await this.cartLink.click();
  }
}
