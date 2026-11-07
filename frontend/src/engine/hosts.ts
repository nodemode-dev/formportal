export const HOSTS: Record<string, string> = {
  formvis: "2.1.0",
  formcut: "2.14.0",
  formwav: "2.24.0",
  formpdf: "0.59.0",
  formdeck: "0.32.0",
  formlit: "0.50.0",
  formmd: "0.50.0",
  formencoder: "0.7.0",
  formvfx: "0.54.0",
  formmcp: "0.9.0",
  formtray: "0.15.0",
  formskills: "0.9.0",
  formportal: "0.63.0",
};

export const EXT_PRODUCTS = Object.keys(HOSTS);

const CATALOGUE: Record<string, string> = { formportal: "formai", formdeck: "formslide" };

export function catalogueId(product: string): string {
  return CATALOGUE[product] ?? product;
}

export function contractId(id: string): string {
  return Object.entries(CATALOGUE).find(([, ours]) => ours === id)?.[0] ?? id;
}

export const MAKER = "formext";
export const MAKER_PAGE = "https://formai.studio/apps/formext/";
