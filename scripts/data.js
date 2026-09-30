// The board's data (SPEC.md 5.2): one hidden "Party Board" JournalEntry whose
// pages are the cards, strings and frames. Everything below the data models is
// a plain function over plain objects, so it can be tested without Foundry.
import { MODULE_ID } from "./constants.js";

export const JOURNAL_FLAG = "board";
export const VISIBILITY = ["everyone", "gm", "private"];
export const ARROWS = ["none", "forward", "both"];
export const CARD_KINDS = ["document", "text", "hub"];

/**
 * Card sizes by kind. Document cards fit a portrait, a name and a caption at
 * table-readable sizes; notes and concepts grow taller to fit their text.
 */
export const CARD_SIZE = { document: { w: 380, h: 132 }, text: { w: 340, h: 96 }, hub: { w: 440, h: 150 } };
export const FRAME_SIZE = { w: 900, h: 560 };

/** The document types a card can be made from, and the image a card uses when the document has none. */
export const DROPPABLE = ["Actor", "Item", "JournalEntry", "JournalEntryPage"];
const FALLBACK_IMAGE = { Actor: "icons/svg/mystery-man.svg", Item: "icons/svg/item-bag.svg", JournalEntry: "icons/svg/book.svg", JournalEntryPage: "icons/svg/book.svg" };

/* -------------------------------------------- */
/*  Data models                                 */
/* -------------------------------------------- */

const fields = () => foundry.data.fields;

/** Fields every card, string and frame has. `locked` is GM-only: players cannot unlock what the GM locked. */
function commonFields() {
  const f = fields();
  return {
    visibility: new f.StringField({ required: true, choices: VISIBILITY, initial: "everyone" }),
    author: new f.StringField({ required: true, blank: true, initial: "" }),
    locked: new f.BooleanField({ initial: false, gmOnly: true })
  };
}

export class CardData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = fields();
    return {
      ...commonFields(),
      kind: new f.StringField({ required: true, choices: CARD_KINDS, initial: "document" }),
      uuid: new f.StringField({ required: false, nullable: true, blank: false, initial: null }),
      x: new f.NumberField({ required: true, nullable: false, initial: 0 }),
      y: new f.NumberField({ required: true, nullable: false, initial: 0 }),
      w: new f.NumberField({ required: true, nullable: false, positive: true, initial: CARD_SIZE.document.w }),
      h: new f.NumberField({ required: true, nullable: false, positive: true, initial: CARD_SIZE.document.h }),
      caption: new f.StringField({ required: true, blank: true, initial: "" }),
      lastName: new f.StringField({ required: true, blank: true, initial: "" }),
      lastImg: new f.StringField({ required: false, nullable: true, initial: null }),
      color: new f.ColorField({ required: false, nullable: true, initial: null })
    };
  }
}

export class StringData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = fields();
    return {
      ...commonFields(),
      from: new f.StringField({ required: true, blank: false }),
      to: new f.StringField({ required: true, blank: false }),
      label: new f.StringField({ required: true, blank: true, initial: "" }),
      arrows: new f.StringField({ required: true, choices: ARROWS, initial: "forward" }),
      color: new f.ColorField({ required: false, nullable: true, initial: null })
    };
  }
}

export class FrameData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = fields();
    return {
      ...commonFields(),
      x: new f.NumberField({ required: true, nullable: false, initial: 0 }),
      y: new f.NumberField({ required: true, nullable: false, initial: 0 }),
      w: new f.NumberField({ required: true, nullable: false, positive: true, initial: 600 }),
      h: new f.NumberField({ required: true, nullable: false, positive: true, initial: 400 }),
      title: new f.StringField({ required: true, blank: true, initial: "" }),
      color: new f.ColorField({ required: false, nullable: true, initial: null })
    };
  }
}

export const DATA_MODELS = { card: CardData, string: StringData, frame: FrameData };

export const pageType = (type) => `${MODULE_ID}.${type}`;

/* -------------------------------------------- */
/*  The board journal                           */
/* -------------------------------------------- */

export const isBoardJournal = (entry) => !!entry?.getFlag?.(MODULE_ID, JOURNAL_FLAG);

/**
 * Creation data for the board journal. Players get OWNER on it because
 * creating a page needs OWNER on the parent entry; the board is shared.
 */
export function boardJournalData(sceneId) {
  return {
    name: "Party Board",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    flags: { [MODULE_ID]: { [JOURNAL_FLAG]: { kind: "party", sceneId } } }
  };
}

/** Find the board journal, creating it if this is the GM who should. */
export async function ensureBoardJournal(scene) {
  const existing = game.journal.find(isBoardJournal);
  if (existing || !game.user.isGM) return existing ?? null;
  if (game.users.activeGM && !game.users.activeGM.isSelf) return null;
  return JournalEntry.create(boardJournalData(scene?.id ?? null));
}

/* -------------------------------------------- */
/*  From pages to what the board draws          */
/* -------------------------------------------- */

/** The first line of text in some HTML, for a journal card's caption. */
export function firstLine(html, max = 60) {
  const text = String(html ?? "")
    .replace(/<\/(p|div|h\d|li)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** The image a card shows for a document. Journals have none, so they get a book. */
export function imageOf(doc) {
  if (!doc) return null;
  const type = doc.documentName;
  if (type === "JournalEntryPage" && doc.type === "image" && doc.src) return doc.src;
  return doc.img || FALLBACK_IMAGE[type] || null;
}

/** A journal card's default caption: the first line of its text. Actors and items have none. */
export function captionOf(doc) {
  if (!doc) return "";
  if (doc.documentName === "JournalEntryPage") return firstLine(doc.text?.content);
  if (doc.documentName === "JournalEntry") {
    const text = doc.pages?.contents?.find?.((p) => p.type === "text");
    return firstLine(text?.text?.content);
  }
  return "";
}

/**
 * What the board draws for a card page. `doc` is the resolved document, or
 * null if it has been deleted; the card then shows its last known name and image.
 */
export function cardViewData(page, doc) {
  const s = page.system;
  const missing = !!s.uuid && !doc;
  return {
    id: page.id,
    kind: s.kind,
    uuid: s.uuid,
    x: s.x, y: s.y, w: s.w, h: s.h,
    name: doc?.name ?? (s.lastName || page.name),
    img: imageOf(doc) ?? s.lastImg ?? null,
    caption: s.caption || captionOf(doc),
    missing,
    color: s.color == null ? null : Number(s.color),
    visibility: s.visibility,
    author: s.author,
    locked: s.locked
  };
}

/** What the board draws for a string page. With no colour of its own it takes its author's. */
export function stringViewData(page, authorColor = null) {
  const s = page.system;
  const own = s.color == null ? null : Number(s.color);
  return {
    id: page.id,
    from: s.from,
    to: s.to,
    label: s.label,
    arrows: s.arrows,
    color: own ?? (authorColor == null ? null : Number(authorColor)),
    visibility: s.visibility,
    author: s.author,
    locked: s.locked
  };
}

/** Creation data for a card made by dropping `doc` at `point`, centred on the drop. */
export function cardCreateData(doc, point, userId) {
  const { w, h } = CARD_SIZE.document;
  return {
    type: pageType("card"),
    name: doc.name,
    system: {
      kind: "document",
      uuid: doc.uuid,
      x: Math.round(point.x - w / 2),
      y: Math.round(point.y - h / 2),
      w, h,
      caption: "",
      lastName: doc.name,
      lastImg: imageOf(doc),
      author: userId
    }
  };
}

/**
 * Whether `user` should see an item (SPEC.md 2: trust the table, so this
 * decides what is drawn, not what is secret). GMs see everything.
 */
export function visibleTo(system, user) {
  if (!system || user?.isGM) return true;
  if (system.visibility === "gm") return false;
  if (system.visibility === "private") return system.author === user?.id;
  return true;
}

/**
 * Whether `user` may change an item. The server enforces a lock through the
 * page's ownership; this decides what the board offers, so nobody is handed an
 * action that would only be refused.
 */
export const canModify = (system, user) => !!user?.isGM || !system?.locked;

/** Creation data for a note or a concept card centred on `point`. */
export function noteCreateData(kind, point, userId) {
  const { w, h } = CARD_SIZE[kind];
  return {
    type: pageType("card"),
    name: kind === "hub" ? "Concept" : "Note",
    system: { kind, uuid: null, x: Math.round(point.x - w / 2), y: Math.round(point.y - h / 2), w, h, caption: "", lastName: "", author: userId }
  };
}

/** Creation data for a frame whose centre is `point`. */
export function frameCreateData(point, userId, title = "New frame") {
  const { w, h } = FRAME_SIZE;
  return {
    type: pageType("frame"),
    name: title,
    system: { x: Math.round(point.x - w / 2), y: Math.round(point.y - h / 2), w, h, title, author: userId }
  };
}

/** What the board draws for a frame page. */
export function frameViewData(page) {
  const s = page.system;
  return {
    id: page.id, x: s.x, y: s.y, w: s.w, h: s.h, title: s.title,
    color: s.color == null ? null : Number(s.color),
    visibility: s.visibility, author: s.author, locked: s.locked
  };
}

/** Creation data for a new, unlabelled string between two cards. */
export function stringCreateData(fromCard, toCard, userId) {
  return {
    type: pageType("string"),
    name: `${fromCard.name} → ${toCard.name}`,
    system: { from: fromCard.id, to: toCard.id, label: "", arrows: "forward", author: userId }
  };
}
