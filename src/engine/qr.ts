import QRCode from "qrcode";

export const generateQrSvg = async (url: string): Promise<string | null> => {
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    return null;
  }

  try {
    return await QRCode.toString(normalizedUrl, {
      type: "svg",
      margin: 0,
      width: 128,
      color: {
        dark: "#0b2340",
        light: "#ffffff",
      },
    });
  } catch {
    return null;
  }
};

export const generateQrPngDataUrl = async (url: string): Promise<string | null> => {
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    return null;
  }

  try {
    return await QRCode.toDataURL(normalizedUrl, {
      margin: 1,
      width: 192,
      color: {
        dark: "#0b2340",
        light: "#ffffff",
      },
    });
  } catch {
    return null;
  }
};

export const hydrateQrPlaceholders = async (root: ParentNode): Promise<void> => {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-qr-url]"));

  await Promise.all(
    nodes.map(async (node) => {
      const svg = await generateQrSvg(node.dataset.qrUrl?.trim() ?? "");
      node.innerHTML = svg ?? "QR";
    }),
  );
};
