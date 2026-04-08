import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { LIMITS } from "../constants";
import { getCvLanguageCopy } from "../i18n";
import type { CvData, CvTheme, SkillBarGroup, SkillTagGroup, TextItem, ValidationIssue } from "../types";
import { generateQrPngDataUrl } from "./qr";
import { formatLineMessage } from "../validationShared";

export type PdfMode = "paginated" | "continuous";

export interface PdfLayoutMetrics {
  pageCount: number;
  pageLimitExceeded: boolean;
  issues: ValidationIssue[];
  continuousHeight: number;
  mainBreakOffsets: number[];
  sidebarBreakOffsets: number[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 18;
const TOP_MARGIN = 18;
const BOTTOM_MARGIN = 18;
const SIDEBAR_WIDTH = 170;
const GUTTER = 18;

const hex = (value: string) => {
  const normalized = value.replace("#", "");
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  );
};

const getPalette = (theme: CvTheme) => {
  switch (theme) {
    case "zen":
      return { sidebar: hex("#204F44"), main: hex("#F5F6EF"), text: hex("#183033"), sideText: hex("#FFFFFF"), accent: hex("#63C594"), soft: hex("#E2F0E7"), track: hex("#7B918A"), sideCard: hex("#2B5B4F"), sideCardText: hex("#F3FBF7"), sideTag: hex("#275447"), panel: hex("#FDFEFB"), panelLine: hex("#C8DDD0"), rolePanel: hex("#FBFCFA"), techPanel: hex("#EEF4EF") };
    case "zen-cream":
      return { sidebar: hex("#6B543E"), main: hex("#F7F1E7"), text: hex("#413329"), sideText: hex("#FFFFFF"), accent: hex("#C89653"), soft: hex("#EFE3D0"), track: hex("#B7AA97"), sideCard: hex("#7A6048"), sideCardText: hex("#FFF9F1"), sideTag: hex("#715942"), panel: hex("#FFFCF7"), panelLine: hex("#DDCFBC"), rolePanel: hex("#FCF8F1"), techPanel: hex("#F6EEE5") };
    case "zen-orange":
      return { sidebar: hex("#E67E6E"), main: hex("#FFF5EE"), text: hex("#4A3731"), sideText: hex("#FFFFFF"), accent: hex("#8AB6D6"), soft: hex("#FAD0B1"), track: hex("#E9D4C8"), sideCard: hex("#F4B497"), sideCardText: hex("#4A3731"), sideTag: hex("#F0B08F"), panel: hex("#FFF9F6"), panelLine: hex("#F2C1A1"), rolePanel: hex("#FFF7F1"), techPanel: hex("#FFF0E6") };
    case "claude":
      return { sidebar: hex("#1D1A17"), main: hex("#F5EFE5"), text: hex("#151310"), sideText: hex("#F7F2EA"), accent: hex("#DE7356"), soft: hex("#EBD8C8"), track: hex("#8B7B6C"), sideCard: hex("#2A241F"), sideCardText: hex("#F7F2EA"), sideTag: hex("#2A241F"), panel: hex("#FBF7F1"), panelLine: hex("#D8C7B8"), rolePanel: hex("#F8F2EA"), techPanel: hex("#EFE7DE") };
    case "graphite":
      return { sidebar: hex("#24272B"), main: hex("#F2F4F7"), text: hex("#1F252C"), sideText: hex("#FFFFFF"), accent: hex("#667A90"), soft: hex("#DFE5EB"), track: hex("#98A5B2"), sideCard: hex("#30363D"), sideCardText: hex("#F8FAFC"), sideTag: hex("#30363D"), panel: hex("#FFFFFF"), panelLine: hex("#CBD4DD"), rolePanel: hex("#FAFBFD"), techPanel: hex("#EEF2F6") };
    case "cyber":
      return { sidebar: hex("#081624"), main: hex("#F3F8FF"), text: hex("#09182A"), sideText: hex("#F5FAFF"), accent: hex("#4AA6FF"), soft: hex("#D8EAFE"), track: hex("#8FA9C5"), sideCard: hex("#102033"), sideCardText: hex("#F5FAFF"), sideTag: hex("#102033"), panel: hex("#FFFFFF"), panelLine: hex("#BBD8FA"), rolePanel: hex("#F9FCFF"), techPanel: hex("#EDF5FD") };
    case "cyber-purple":
      return { sidebar: hex("#120C24"), main: hex("#F7F1FF"), text: hex("#1B1430"), sideText: hex("#F8F3FF"), accent: hex("#B06CFF"), soft: hex("#E9DBFF"), track: hex("#AF9BCB"), sideCard: hex("#1F1738"), sideCardText: hex("#F8F3FF"), sideTag: hex("#1F1738"), panel: hex("#FFFDFF"), panelLine: hex("#D9C4FB"), rolePanel: hex("#FCFAFF"), techPanel: hex("#F3ECFE") };
    case "ocean":
    default:
      return { sidebar: hex("#112D4E"), main: hex("#FFFFFF"), text: hex("#10243D"), sideText: hex("#FFFFFF"), accent: hex("#1299FF"), soft: hex("#E6F3FF"), track: hex("#96A4B2"), sideCard: hex("#17375E"), sideCardText: hex("#F2F7FF"), sideTag: hex("#16355A"), panel: hex("#FFFFFF"), panelLine: hex("#D1E6F9"), rolePanel: hex("#F8FBFE"), techPanel: hex("#EEF2F7") };
  }
};

const normalize = (value: string): string => value.replace(/\r\n/g, "\n").trim();
const lineHeight = (size: number): number => size * 1.24;

const wrapText = (text: string, font: PDFFont, size: number, width: number): string[] => {
  const normalized = normalize(text);
  if (!normalized) {
    return [""];
  }

  const lines: string[] = [];
  for (const paragraph of normalized.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : [""];
};

const textHeight = (text: string, font: PDFFont, size: number, width: number): number =>
  wrapText(text, font, size, width).length * lineHeight(size);

const issueIfTooTall = (
  issues: ValidationIssue[],
  label: string,
  maxLines: number,
  value: string,
  language: CvData["render"]["language"],
  font: PDFFont,
  fontSize: number,
  width: number,
  targetBind?: string,
): void => {
  const lineCount = wrapText(value, font, fontSize, width).length;
  if (lineCount > maxLines) {
    issues.push({
      id: `${targetBind ?? label}-${maxLines}`,
      message: formatLineMessage(label, maxLines, value, language),
      targetBind,
    });
  }
};

class Flow {
  page = 0;
  top = 0;
  maxTop = 0;
  breakOffsets: number[] = [];

  constructor(private readonly mode: PdfMode, private readonly contentHeight: number) {}

  reserve(
    height: number,
    options: { trackBreakOffset?: boolean } = {},
  ): { page: number; top: number } {
    const trackBreakOffset = options.trackBreakOffset ?? true;
    if (this.mode === "paginated" && this.top > 0 && this.top + height > this.contentHeight) {
      this.page += 1;
      this.top = 0;
    }

    const placement = { page: this.page, top: this.top };
    this.top += height;
    this.maxTop = Math.max(this.maxTop, this.top);
    if (trackBreakOffset) {
      this.breakOffsets.push(this.absoluteTop());
    }
    return placement;
  }

  gap(height: number): void {
    this.reserve(height, { trackBreakOffset: false });
  }

  absoluteTop(): number {
    return this.page * this.contentHeight + this.top;
  }
}

const drawLines = (
  page: PDFPage,
  lines: string[],
  x: number,
  top: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  pageHeight: number,
): void => {
  const lh = lineHeight(size);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: pageHeight - TOP_MARGIN - top - size - index * lh,
      size,
      font,
      color,
    });
  });
};

const createPage = (doc: PDFDocument, pageHeight: number, sidebarPosition: "left" | "right", palette: ReturnType<typeof getPalette>): PDFPage => {
  const mainWidth = PAGE_WIDTH - PAGE_MARGIN * 2 - SIDEBAR_WIDTH - GUTTER;
  const sidebarX = sidebarPosition === "left" ? 0 : PAGE_WIDTH - SIDEBAR_WIDTH - PAGE_MARGIN;
  const page = doc.addPage([PAGE_WIDTH, pageHeight]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: pageHeight, color: palette.main });
  page.drawRectangle({ x: sidebarX, y: 0, width: SIDEBAR_WIDTH + PAGE_MARGIN, height: pageHeight, color: palette.sidebar });
  page.drawRectangle({ x: sidebarPosition === "left" ? PAGE_MARGIN + SIDEBAR_WIDTH + GUTTER / 2 : PAGE_MARGIN + mainWidth + GUTTER / 2, y: 0, width: 1, height: pageHeight, color: palette.soft, opacity: 0.8 });
  return page;
};

const collectBulletHeight = (bullets: TextItem[], font: PDFFont, width: number): number =>
  bullets.reduce((total, bullet) => total + textHeight(bullet.text, font, 10, width) + 4, 0);

const normalizeBreakOffsets = (values: number[], maxHeight: number): number[] => {
  const lowerBound = 36;
  const upperBound = Math.max(lowerBound, maxHeight - 36);
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.round(value * 100) / 100)
    .filter((value) => value >= lowerBound && value <= upperBound)
    .sort((a, b) => a - b);

  const unique: number[] = [];
  for (const value of sorted) {
    if (unique.length === 0 || Math.abs(value - unique[unique.length - 1]!) > 1) {
      unique.push(value);
    }
  }

  return unique;
};

const measureLayout = async (data: CvData, mode: PdfMode): Promise<{ metrics: PdfLayoutMetrics; regular: PDFFont; bold: PDFFont }> => {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const issues: ValidationIssue[] = [];
  const copy = getCvLanguageCopy(data.render.language);
  const contentHeight = PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const sidebarTextWidth = SIDEBAR_WIDTH - 20;
  const mainWidth = PAGE_WIDTH - PAGE_MARGIN * 2 - SIDEBAR_WIDTH - GUTTER;

  const sidebar = new Flow(mode, contentHeight);
  sidebar.reserve(92);
  for (const value of [data.header.location, data.header.email, data.header.linkedin, data.header.availabilityText]) {
    sidebar.reserve(textHeight(value, bold, 10, sidebarTextWidth) + 4);
  }
  if (data.header.showQrCode) {
    sidebar.reserve(72 + textHeight(data.header.qrCodeLabel, bold, 9, sidebarTextWidth - 12) + textHeight(data.header.qrCodeUrl, regular, 7.5, sidebarTextWidth - 12) + 18);
  }
  sidebar.gap(12);
  sidebar.reserve(textHeight(copy.sectionSkills.toUpperCase(), bold, 12, sidebarTextWidth) + 8);
  data.skillGroups.forEach((group) => {
    sidebar.reserve(textHeight(group.title, bold, 11, sidebarTextWidth) + 4);
    if (group.type === "bars") {
      (group as SkillBarGroup).items.forEach((item) => sidebar.reserve(Math.max(32, textHeight(item.label, regular, 9.5, sidebarTextWidth - 26) + 18) + 8));
    } else {
      const items = (group as SkillTagGroup).items;
      const maxWidth = SIDEBAR_WIDTH - 20;
      let rowWidth = 0;
      let rows = 1;
      items.forEach((item) => {
        const width = Math.min(maxWidth, regular.widthOfTextAtSize(item.label, 8.5) + 18);
        if (rowWidth > 0 && rowWidth + 8 + width > maxWidth) {
          rows += 1;
          rowWidth = width;
        } else {
          rowWidth = rowWidth > 0 ? rowWidth + 8 + width : width;
        }
      });
      sidebar.reserve(rows * 22 + 4);
    }
  });

  ([
    [copy.sectionHighlights.toUpperCase(), data.highlights.length],
    [copy.sectionCertifications.toUpperCase(), data.certifications.length],
    [copy.sectionFormations.toUpperCase(), data.formations.length],
    [copy.sectionLanguages.toUpperCase(), data.languages.length],
  ] as Array<[string, number]>).forEach(([title, count]) => {
    if (count > 0) {
      sidebar.gap(10);
      sidebar.reserve(textHeight(String(title), bold, 12, sidebarTextWidth) + 8);
    }
  });

  data.highlights.forEach((item, index) => {
    issueIfTooTall(
      issues,
      copy.sectionHighlights,
      LIMITS.highlightLines,
      item.text,
      data.render.language,
      bold,
      9.5,
      sidebarTextWidth - 18,
      `highlights.${index}.text`,
    );
    sidebar.reserve(22 + textHeight(item.text, bold, 9.5, sidebarTextWidth - 18));
  });
  data.certifications.forEach((item, index) => {
    issueIfTooTall(
      issues,
      copy.labelTitle,
      LIMITS.certificationTitleLines,
      item.title,
      data.render.language,
      bold,
      9.5,
      sidebarTextWidth - 18,
      `certifications.${index}.title`,
    );
    issueIfTooTall(
      issues,
      copy.labelSecondary,
      LIMITS.certificationMetaLines,
      item.subtitle,
      data.render.language,
      regular,
      8.5,
      sidebarTextWidth - 18,
      `certifications.${index}.subtitle`,
    );
    if (item.meta) {
      issueIfTooTall(
        issues,
        copy.labelMetadata,
        1,
        item.meta,
        data.render.language,
        regular,
        8,
        sidebarTextWidth - 18,
        `certifications.${index}.meta`,
      );
    }
    sidebar.reserve(22 + textHeight(item.title, bold, 9.5, sidebarTextWidth - 18) + textHeight(item.subtitle, regular, 8.5, sidebarTextWidth - 18) + (item.meta ? textHeight(item.meta, regular, 8, sidebarTextWidth - 18) : 0));
  });
  data.formations.forEach((item, index) => {
    issueIfTooTall(issues, copy.labelTitle, 2, item.title, data.render.language, bold, 9.5, sidebarTextWidth - 18, `formations.${index}.title`);
    issueIfTooTall(
      issues,
      copy.labelSecondary,
      LIMITS.certificationMetaLines,
      item.subtitle,
      data.render.language,
      regular,
      8.5,
      sidebarTextWidth - 18,
      `formations.${index}.subtitle`,
    );
    sidebar.reserve(22 + textHeight(item.title, bold, 9.5, sidebarTextWidth - 18) + textHeight(item.subtitle, regular, 8.5, sidebarTextWidth - 18) + (item.meta ? textHeight(item.meta, regular, 8, sidebarTextWidth - 18) : 0));
  });
  data.languages.forEach((item, index) => {
    issueIfTooTall(
      issues,
      copy.labelLanguageLevel,
      LIMITS.languageLines,
      item.subtitle,
      data.render.language,
      regular,
      8.5,
      sidebarTextWidth - 18,
      `languages.${index}.subtitle`,
    );
    sidebar.reserve(22 + textHeight(item.title, bold, 9.5, sidebarTextWidth - 18) + textHeight(item.subtitle, regular, 8.5, sidebarTextWidth - 18));
  });

  const main = new Flow(mode, contentHeight);
  const mainSoftBreakOffsets: number[] = [];
  main.reserve(textHeight(data.header.name, bold, 28, mainWidth) + textHeight(data.header.headline, bold, 13, mainWidth) + 16);
  issueIfTooTall(issues, data.profileLabel, LIMITS.profileLines, data.profile, data.render.language, regular, 10, mainWidth - 70, "profile");
  main.reserve(textHeight(`${data.profileLabel} : ${data.profile}`, regular, 10, mainWidth - 20) + 16);
  main.gap(16);
  main.reserve(textHeight(copy.sectionExperienceAndProjects.toUpperCase(), bold, 18, mainWidth) + 8);

  data.experiences.forEach((experience, experienceIndex) => {
    const experienceStartOffset = main.absoluteTop();
    issueIfTooTall(issues, copy.labelPeriod, 1, experience.period, data.render.language, regular, 8.5, mainWidth - 40, `experiences.${experienceIndex}.period`);
    issueIfTooTall(
      issues,
      copy.labelExperienceSubtitle,
      2,
      experience.subtitle,
      data.render.language,
      bold,
      10.5,
      mainWidth - 40,
      `experiences.${experienceIndex}.subtitle`,
    );
    issueIfTooTall(issues, experience.techEnvironmentLabel, LIMITS.techEnvironmentLines, experience.techEnvironment, data.render.language, regular, 8.75, mainWidth - 52, `experiences.${experienceIndex}.techEnvironment`);
    experience.bullets.forEach((bullet, bulletIndex) =>
      issueIfTooTall(
        issues,
        copy.labelBulletPoint,
        LIMITS.bulletLines,
        bullet.text,
        data.render.language,
        regular,
        10,
        mainWidth - 54,
        `experiences.${experienceIndex}.bullets.${bulletIndex}.text`,
      ),
    );
    const periodHeight = textHeight(experience.period, regular, 8.5, mainWidth - 40);
    const subtitleHeight = textHeight(experience.subtitle, bold, 10.5, mainWidth - 40);
    const experienceTechHeight = textHeight(`${experience.techEnvironmentLabel} : ${experience.techEnvironment}`, regular, 8.75, mainWidth - 40);
    const bulletHeights = experience.bullets.map((bullet) => textHeight(bullet.text, regular, 10, mainWidth - 54) + 4);
    let experienceHeight = 48 + periodHeight + subtitleHeight + experienceTechHeight;
    let relativeOffset = 48 + periodHeight + subtitleHeight;
    mainSoftBreakOffsets.push(experienceStartOffset + relativeOffset);
    bulletHeights.forEach((bulletHeight) => {
      relativeOffset += bulletHeight;
      experienceHeight += bulletHeight;
      mainSoftBreakOffsets.push(experienceStartOffset + relativeOffset);
    });
    experience.projects.forEach((project, projectIndex) => {
      issueIfTooTall(
        issues,
        copy.labelPeriod,
        1,
        project.period,
        data.render.language,
        regular,
        8.5,
        mainWidth - 68,
        `experiences.${experienceIndex}.projects.${projectIndex}.period`,
      );
      issueIfTooTall(issues, project.techEnvironmentLabel, LIMITS.techEnvironmentLines, project.techEnvironment, data.render.language, regular, 8.5, mainWidth - 68, `experiences.${experienceIndex}.projects.${projectIndex}.techEnvironment`);
      project.bullets.forEach((bullet, bulletIndex) =>
        issueIfTooTall(
          issues,
          copy.labelBulletPoint,
          LIMITS.bulletLines,
          bullet.text,
          data.render.language,
          regular,
          10,
          mainWidth - 80,
          `experiences.${experienceIndex}.projects.${projectIndex}.bullets.${bulletIndex}.text`,
        ),
      );
      const projectTitleHeight = textHeight(project.title, bold, 11, mainWidth - 68);
      const projectPeriodHeight = textHeight(project.period, regular, 8.5, mainWidth - 68);
      const projectTechHeight = textHeight(`${project.techEnvironmentLabel} : ${project.techEnvironment}`, regular, 8.5, mainWidth - 68);
      const projectBulletHeights = project.bullets.map((bullet) => textHeight(bullet.text, regular, 10, mainWidth - 80) + 4);
      let projectRelativeHeight = 24 + projectTitleHeight + projectPeriodHeight + projectTechHeight;
      let projectOffset = relativeOffset + 24 + projectTitleHeight + projectPeriodHeight;
      mainSoftBreakOffsets.push(experienceStartOffset + projectOffset);
      projectBulletHeights.forEach((bulletHeight) => {
        projectOffset += bulletHeight;
        projectRelativeHeight += bulletHeight;
        mainSoftBreakOffsets.push(experienceStartOffset + projectOffset);
      });
      projectOffset += projectTechHeight;
      mainSoftBreakOffsets.push(experienceStartOffset + projectOffset);
      experienceHeight += projectRelativeHeight;
      relativeOffset += projectRelativeHeight;
    });
    relativeOffset += experienceTechHeight;
    mainSoftBreakOffsets.push(experienceStartOffset + relativeOffset);
    main.reserve(experienceHeight);
    main.gap(10);
  });

  if (data.mainEducation.enabled) {
    main.reserve(textHeight(data.mainEducation.title.toUpperCase(), bold, 18, mainWidth) + 8);
    main.reserve(textHeight(data.mainEducation.summary, regular, 10, mainWidth) + 8);
  }

  const pageCount = mode === "continuous" ? 1 : Math.max(sidebar.page + 1, main.page + 1);
  const contentMaxHeight = Math.max(sidebar.maxTop, main.maxTop);
  const continuousHeight = contentMaxHeight + TOP_MARGIN + BOTTOM_MARGIN + 8;
  const mainBreakOffsets = normalizeBreakOffsets(
    [...main.breakOffsets, ...mainSoftBreakOffsets],
    contentMaxHeight,
  );
  const sidebarBreakOffsets = normalizeBreakOffsets(sidebar.breakOffsets, contentMaxHeight);
  const pageLimitExceeded = data.render.maxPages !== null && pageCount > data.render.maxPages;
  if (pageLimitExceeded) {
    issues.push({
      id: `page-limit-${data.render.maxPages}`,
      message: copy.pageLimitExceeded(Number(data.render.maxPages)),
    });
  }

  return {
    metrics: {
      pageCount,
      pageLimitExceeded,
      issues,
      continuousHeight,
      mainBreakOffsets,
      sidebarBreakOffsets,
    },
    regular,
    bold,
  };
};

export const measureCvLayout = async (data: CvData, mode: PdfMode = "paginated"): Promise<PdfLayoutMetrics> =>
  (await measureLayout(data, mode)).metrics;

export const renderCvPdfWithEmbeddedLibrary = async (data: CvData, mode: PdfMode = "paginated"): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { metrics } = await measureLayout(data, mode);
  const copy = getCvLanguageCopy(data.render.language);
  const palette = getPalette(data.render.theme);
  const pageHeight = mode === "continuous" ? Math.max(PAGE_HEIGHT, metrics.continuousHeight) : PAGE_HEIGHT;
  const mainWidth = PAGE_WIDTH - PAGE_MARGIN * 2 - SIDEBAR_WIDTH - GUTTER;
  const sidebarX = data.render.sidebarPosition === "left" ? PAGE_MARGIN : PAGE_MARGIN + mainWidth + GUTTER;
  const mainX = data.render.sidebarPosition === "left" ? PAGE_MARGIN + SIDEBAR_WIDTH + GUTTER : PAGE_MARGIN;
  const pages = Array.from({ length: mode === "continuous" ? 1 : metrics.pageCount }, () => createPage(pdf, pageHeight, data.render.sidebarPosition, palette));
  const sidebar = new Flow(mode, pageHeight - TOP_MARGIN - BOTTOM_MARGIN);
  const main = new Flow(mode, pageHeight - TOP_MARGIN - BOTTOM_MARGIN);

  const pageFor = (index: number): PDFPage => pages[index]!;
  const drawBlock = (flow: Flow, height: number, cb: (page: PDFPage, top: number) => void) => {
    const placement = flow.reserve(height);
    cb(pageFor(placement.page), placement.top);
  };

  drawBlock(sidebar, 92, (page, top) => {
    const diameter = 72;
    const y = pageHeight - TOP_MARGIN - top - diameter;
    const centerX = sidebarX + SIDEBAR_WIDTH / 2;
    page.drawCircle({ x: centerX, y: y + diameter / 2, size: diameter / 2, borderColor: palette.accent, borderWidth: 1.5 });
    page.drawText(data.header.badgeText, { x: centerX - bold.widthOfTextAtSize(data.header.badgeText, 20) / 2, y: y + diameter / 2 - 8, font: bold, size: 20, color: palette.accent });
  });
  sidebar.gap(12);

  for (const text of [data.header.location, data.header.email, data.header.linkedin, data.header.availabilityText]) {
    const lines = wrapText(text, bold, 10, SIDEBAR_WIDTH - 20);
    drawBlock(sidebar, lines.length * lineHeight(10) + 4, (page, top) => drawLines(page, lines, sidebarX + 12, top, bold, 10, palette.sideText, pageHeight));
  }

  if (data.header.showQrCode) {
    const labelLines = wrapText(data.header.qrCodeLabel, bold, 9, SIDEBAR_WIDTH - 32);
    const urlLines = wrapText(data.header.qrCodeUrl, regular, 7.5, SIDEBAR_WIDTH - 32);
    const qrDataUrl = await generateQrPngDataUrl(data.header.qrCodeUrl);
    const qrImage = qrDataUrl ? await pdf.embedPng(qrDataUrl) : null;
    drawBlock(sidebar, 72 + labelLines.length * lineHeight(9) + urlLines.length * lineHeight(7.5) + 18, (page, top) => {
      const boxSize = 54;
      const boxX = sidebarX + (SIDEBAR_WIDTH - boxSize) / 2;
      const boxY = pageHeight - TOP_MARGIN - top - boxSize;
      page.drawRectangle({ x: boxX - 2, y: boxY - 2, width: boxSize + 4, height: boxSize + 4, color: rgb(1, 1, 1) });
      if (qrImage) {
        page.drawImage(qrImage, {
          x: boxX,
          y: boxY,
          width: boxSize,
          height: boxSize,
        });
      } else {
        page.drawRectangle({ x: boxX, y: boxY, width: boxSize, height: boxSize, color: rgb(1, 1, 1), borderColor: palette.sideText, borderWidth: 0.75 });
        page.drawText("QR", { x: boxX + 17, y: boxY + 20, font: bold, size: 14, color: palette.text });
      }
      drawLines(page, labelLines, sidebarX + 16, top + 60, bold, 9, palette.sideText, pageHeight);
      drawLines(
        page,
        urlLines,
        sidebarX + 16,
        top + 60 + labelLines.length * lineHeight(9) + 4,
        regular,
        7.5,
        palette.sideText,
        pageHeight,
      );
    });
  }

  const drawSection = (flow: Flow, title: string, x: number, width: number, side: boolean) => {
    const lines = wrapText(title, bold, side ? 12 : 18, width);
    drawBlock(flow, lines.length * lineHeight(side ? 12 : 18) + 8, (page, top) => drawLines(page, lines, x, top, bold, side ? 12 : 18, side ? palette.accent : palette.text, pageHeight));
  };

  sidebar.gap(12);
  drawSection(sidebar, copy.sectionSkills.toUpperCase(), sidebarX + 10, SIDEBAR_WIDTH - 20, true);
  data.skillGroups.forEach((group) => {
    const groupLines = wrapText(group.title, bold, 11, SIDEBAR_WIDTH - 20);
    drawBlock(sidebar, groupLines.length * lineHeight(11) + 4, (page, top) => drawLines(page, groupLines, sidebarX + 10, top, bold, 11, palette.accent, pageHeight));
    if (group.type === "bars") {
      (group as SkillBarGroup).items.forEach((item) => {
        const lines = wrapText(item.label, regular, 9.5, SIDEBAR_WIDTH - 46);
        drawBlock(sidebar, Math.max(32, lines.length * lineHeight(9.5) + 18) + 8, (page, top) => {
          const height = Math.max(32, lines.length * lineHeight(9.5) + 18) + 6;
          const y = pageHeight - TOP_MARGIN - top - height;
          page.drawRectangle({ x: sidebarX + 10, y, width: SIDEBAR_WIDTH - 20, height, color: palette.sideCard, borderColor: palette.soft, borderWidth: 0.4 });
          drawLines(page, lines, sidebarX + 20, top + 8, regular, 9.5, palette.sideCardText, pageHeight);
          page.drawText(`${item.level}%`, { x: sidebarX + SIDEBAR_WIDTH - 36, y: pageHeight - TOP_MARGIN - top - 14, font: bold, size: 8.5, color: palette.sideText });
          page.drawRectangle({ x: sidebarX + 20, y: y + 10, width: SIDEBAR_WIDTH - 40, height: 4, color: palette.track, opacity: 0.5 });
          page.drawRectangle({ x: sidebarX + 20, y: y + 10, width: ((SIDEBAR_WIDTH - 40) * item.level) / 100, height: 4, color: palette.accent });
        });
      });
    } else {
      const items = (group as SkillTagGroup).items;
      const maxWidth = SIDEBAR_WIDTH - 20;
      let rowWidth = 0;
      let rows = 1;
      const widths = items.map((item) => Math.min(maxWidth, regular.widthOfTextAtSize(item.label, 8.5) + 18));
      widths.forEach((width) => {
        if (rowWidth > 0 && rowWidth + 8 + width > maxWidth) {
          rows += 1;
          rowWidth = width;
        } else {
          rowWidth = rowWidth > 0 ? rowWidth + 8 + width : width;
        }
      });
      drawBlock(sidebar, rows * 22 + 4, (page, top) => {
        let row = 0;
        let cursorX = sidebarX + 10;
        widths.forEach((width, index) => {
          if (cursorX > sidebarX + 10 && cursorX + width > sidebarX + 10 + maxWidth) {
            row += 1;
            cursorX = sidebarX + 10;
          }
          const pillTop = top + row * 22;
          const pillY = pageHeight - TOP_MARGIN - pillTop - 18;
          page.drawRectangle({ x: cursorX, y: pillY, width, height: 18, color: palette.sideTag, borderColor: palette.soft, borderWidth: 0.4 });
          page.drawText(items[index].label, { x: cursorX + 8, y: pillY + 5, font: regular, size: 8.5, color: palette.sideCardText });
          cursorX += width + 8;
        });
      });
    }
  });

  const drawSidebarCards = (title: string, cards: Array<{ title: string; subtitle: string; meta?: string }>) => {
    if (cards.length === 0) return;
    sidebar.gap(10);
    drawSection(sidebar, title, sidebarX + 10, SIDEBAR_WIDTH - 20, true);
    cards.forEach((card) => {
      const titleLines = wrapText(card.title, bold, 9.5, SIDEBAR_WIDTH - 38);
      const subtitleLines = wrapText(card.subtitle, regular, 8.5, SIDEBAR_WIDTH - 38);
      const metaLines = card.meta ? wrapText(card.meta, regular, 8, SIDEBAR_WIDTH - 38) : [];
      const height = 22 + titleLines.length * lineHeight(9.5) + subtitleLines.length * lineHeight(8.5) + metaLines.length * lineHeight(8);
      drawBlock(sidebar, height, (page, top) => {
        const y = pageHeight - TOP_MARGIN - top - (height - 8);
        page.drawRectangle({ x: sidebarX + 10, y, width: SIDEBAR_WIDTH - 12, height: height - 8, color: palette.sideCard, borderColor: palette.soft, borderWidth: 0.5 });
        drawLines(page, titleLines, sidebarX + 20, top + 8, bold, 9.5, palette.sideCardText, pageHeight);
        drawLines(page, subtitleLines, sidebarX + 20, top + 10 + titleLines.length * lineHeight(9.5), regular, 8.5, palette.sideCardText, pageHeight);
        if (metaLines.length > 0) drawLines(page, metaLines, sidebarX + 20, top + 12 + titleLines.length * lineHeight(9.5) + subtitleLines.length * lineHeight(8.5), regular, 8, palette.sideCardText, pageHeight);
      });
    });
  };

  drawSidebarCards(copy.sectionHighlights.toUpperCase(), data.highlights.map((item) => ({ title: item.text, subtitle: "" })));
  drawSidebarCards(copy.sectionCertifications.toUpperCase(), data.certifications);
  drawSidebarCards(copy.sectionFormations.toUpperCase(), data.formations);
  drawSidebarCards(copy.sectionLanguages.toUpperCase(), data.languages);

  drawBlock(main, textHeight(data.header.name, bold, 28, mainWidth) + textHeight(data.header.headline, bold, 13, mainWidth) + 16, (page, top) => {
    drawLines(page, wrapText(data.header.name, bold, 28, mainWidth), mainX, top, bold, 28, palette.text, pageHeight);
    const nameHeight = textHeight(data.header.name, bold, 28, mainWidth);
    drawLines(page, wrapText(data.header.headline, bold, 13, mainWidth), mainX, top + nameHeight + 2, bold, 13, palette.accent, pageHeight);
    page.drawRectangle({ x: mainX, y: pageHeight - TOP_MARGIN - top - nameHeight - textHeight(data.header.headline, bold, 13, mainWidth) - 10, width: mainWidth, height: 2, color: palette.accent });
  });

  main.gap(10);
  const profileLines = wrapText(`${data.profileLabel} : ${data.profile}`, regular, 10, mainWidth - 20);
  drawBlock(main, profileLines.length * lineHeight(10) + 16, (page, top) => {
    const height = profileLines.length * lineHeight(10) + 16;
    const y = pageHeight - TOP_MARGIN - top - height;
    page.drawRectangle({ x: mainX, y, width: mainWidth, height, color: palette.soft });
    page.drawRectangle({ x: mainX, y, width: 2, height, color: palette.accent });
    drawLines(page, profileLines, mainX + 10, top + 8, regular, 10, palette.text, pageHeight);
  });

  main.gap(16);
  drawSection(main, copy.sectionExperienceAndProjects.toUpperCase(), mainX, mainWidth, false);
  main.gap(6);

  data.experiences.forEach((experience) => {
    const roleLines = wrapText(experience.role, bold, 12.5, mainWidth * 0.58);
    const companyLines = wrapText(experience.company, bold, 11, mainWidth * 0.36);
    const periodLines = wrapText(experience.period, regular, 8.5, mainWidth - 40);
    const subtitleLines = wrapText(experience.subtitle, bold, 10.5, mainWidth - 40);
    const techLines = wrapText(`${experience.techEnvironmentLabel} : ${experience.techEnvironment}`, regular, 8.75, mainWidth - 40);
    const bulletsHeight = collectBulletHeight(experience.bullets, regular, mainWidth - 54);
    const projectsHeight = experience.projects.reduce((total, project) => total + 24 + textHeight(project.title, bold, 11, mainWidth - 68) + textHeight(project.period, regular, 8.5, mainWidth - 68) + collectBulletHeight(project.bullets, regular, mainWidth - 80) + textHeight(`${project.techEnvironmentLabel} : ${project.techEnvironment}`, regular, 8.5, mainWidth - 68), 0);
    const height = 48 + Math.max(roleLines.length * lineHeight(12.5), companyLines.length * lineHeight(11)) + periodLines.length * lineHeight(8.5) + subtitleLines.length * lineHeight(10.5) + bulletsHeight + projectsHeight + techLines.length * lineHeight(8.75);
    drawBlock(main, height, (page, top) => {
      const y = pageHeight - TOP_MARGIN - top - height + 10;
      page.drawCircle({ x: mainX + 6, y: y + height - 22, size: 4.5, borderColor: palette.accent, borderWidth: 1.2 });
      page.drawRectangle({ x: mainX + 5.5, y, width: 1, height: height - 12, color: palette.soft });
      page.drawRectangle({ x: mainX + 18, y, width: mainWidth - 6, height: height - 10, color: palette.rolePanel, borderColor: palette.panelLine, borderWidth: 0.6 });
      drawLines(page, roleLines, mainX + 30, top + 10, bold, 12.5, palette.text, pageHeight);
      drawLines(page, companyLines, mainX + 30 + mainWidth * 0.58, top + 10, bold, 11, palette.accent, pageHeight);
      let cursorTop = top + 12 + Math.max(roleLines.length * lineHeight(12.5), companyLines.length * lineHeight(11));
      const periodBadgeY = pageHeight - TOP_MARGIN - cursorTop - (periodLines.length * lineHeight(8.5) + 4);
      page.drawRectangle({ x: mainX + 30, y: periodBadgeY, width: 46, height: periodLines.length * lineHeight(8.5) + 4, color: palette.soft });
      drawLines(page, periodLines, mainX + 34, cursorTop + 2, regular, 8.5, palette.text, pageHeight);
      cursorTop += periodLines.length * lineHeight(8.5) + 4;
      const subtitleY = pageHeight - TOP_MARGIN - cursorTop - (subtitleLines.length * lineHeight(10.5) + 6);
      page.drawRectangle({ x: mainX + 30, y: subtitleY, width: Math.min(mainWidth - 80, 12 + bold.widthOfTextAtSize(experience.subtitle, 10.5)), height: subtitleLines.length * lineHeight(10.5) + 6, color: rgb(1, 1, 1), borderColor: palette.panelLine, borderWidth: 0.5 });
      drawLines(page, subtitleLines, mainX + 36, cursorTop + 3, bold, 10.5, palette.text, pageHeight);
      cursorTop += subtitleLines.length * lineHeight(10.5) + 6;
      experience.bullets.forEach((bullet) => {
        const lines = wrapText(bullet.text, regular, 10, mainWidth - 54);
        const bulletY = pageHeight - TOP_MARGIN - cursorTop - 9;
        page.drawCircle({ x: mainX + 35, y: bulletY + 2, size: 2.2, color: palette.accent });
        drawLines(page, lines, mainX + 44, cursorTop, regular, 10, palette.text, pageHeight);
        cursorTop += lines.length * lineHeight(10) + 4;
      });
      experience.projects.forEach((project) => {
        cursorTop += 8;
        const projectTitle = wrapText(project.title, bold, 11, mainWidth - 68);
        const projectPeriod = wrapText(project.period, regular, 8.5, mainWidth - 68);
        const tech = wrapText(`${project.techEnvironmentLabel} : ${project.techEnvironment}`, regular, 8.5, mainWidth - 68);
        const projectHeight = 16 + projectTitle.length * lineHeight(11) + projectPeriod.length * lineHeight(8.5) + collectBulletHeight(project.bullets, regular, mainWidth - 80) + tech.length * lineHeight(8.5);
        const projectY = pageHeight - TOP_MARGIN - cursorTop - projectHeight + 8;
        page.drawRectangle({ x: mainX + 30, y: projectY, width: mainWidth - 36, height: projectHeight - 8, color: palette.panel, borderColor: palette.panelLine, borderWidth: 0.6 });
        drawLines(page, projectTitle, mainX + 40, cursorTop + 8, bold, 11, palette.text, pageHeight);
        let projectTop = cursorTop + 10 + projectTitle.length * lineHeight(11);
        const projectPeriodY = pageHeight - TOP_MARGIN - projectTop - (projectPeriod.length * lineHeight(8.5) + 4);
        page.drawRectangle({ x: mainX + 40, y: projectPeriodY, width: 46, height: projectPeriod.length * lineHeight(8.5) + 4, color: palette.soft });
        drawLines(page, projectPeriod, mainX + 44, projectTop + 2, regular, 8.5, palette.text, pageHeight);
        projectTop += projectPeriod.length * lineHeight(8.5) + 4;
        project.bullets.forEach((bullet) => {
          const lines = wrapText(bullet.text, regular, 10, mainWidth - 80);
          const bulletY = pageHeight - TOP_MARGIN - projectTop - 9;
          page.drawCircle({ x: mainX + 45, y: bulletY + 2, size: 2.2, color: palette.accent });
          drawLines(page, lines, mainX + 54, projectTop, regular, 10, palette.text, pageHeight);
          projectTop += lines.length * lineHeight(10) + 4;
        });
        const techY = pageHeight - TOP_MARGIN - projectTop - (tech.length * lineHeight(8.5) + 8);
        page.drawRectangle({ x: mainX + 40, y: techY, width: mainWidth - 56, height: tech.length * lineHeight(8.5) + 8, color: palette.techPanel });
        drawLines(page, tech, mainX + 46, projectTop + 4, regular, 8.5, palette.text, pageHeight);
        cursorTop += projectHeight;
      });
      cursorTop += 4;
      const roleTechY = pageHeight - TOP_MARGIN - cursorTop - (techLines.length * lineHeight(8.75) + 8);
      page.drawRectangle({ x: mainX + 30, y: roleTechY, width: mainWidth - 56, height: techLines.length * lineHeight(8.75) + 8, color: palette.techPanel });
      drawLines(page, techLines, mainX + 36, cursorTop + 4, regular, 8.75, palette.text, pageHeight);
    });
    main.gap(10);
  });

  if (data.mainEducation.enabled) {
    drawSection(main, data.mainEducation.title.toUpperCase(), mainX, mainWidth, false);
    const lines = wrapText(data.mainEducation.summary, regular, 10, mainWidth);
    drawBlock(main, lines.length * lineHeight(10) + 8, (page, top) => drawLines(page, lines, mainX, top, regular, 10, palette.text, pageHeight));
  }

  return await pdf.save();
};
