export type CheckoutFrameProps = {
  /** The checkout page to show (GET /whop/checkout on the backend). */
  url: string;
  /** Whatever the page posted, unparsed: the sheet decides what it means. */
  onMessage: (data: unknown) => void;
  /** The page could not be shown at all. */
  onError: () => void;
};
