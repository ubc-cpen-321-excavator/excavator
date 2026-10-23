import { PlacesClient } from "@googlemaps/places";
import { GemModel, type GemDoc, type GemInput } from "../models/gemModel";

class Place {
  readonly name: string;
  private displayName?: string;
  readonly latitude: number;
  readonly longitude: number;

  constructor(name: string, latitude: number, longitude: number) {
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
  }

  getDisplayName(): string {
    return this.displayName ?? this.name;
  }

  setDisplayName(displayName: string): void {
    this.displayName = displayName;
  }
}

interface GemInfo {
  description?: string | undefined;
  type?: string | undefined;
  nicheness?: number | undefined;
  popularity?: number | undefined;
  certainty?: number | undefined;
  addedBy?: string | undefined;
}

class Gem {
  readonly name: string;
  readonly place: Place;
  info: GemInfo = {};
  protected score?: number;
  protected scoreTime?: number;

  constructor(name: string, place: Place) {
    this.name = name;
    this.place = place;
  }

  // Same shape as the frontend Gem (id, name, description, latitude, longitude) + extras.
  toJSON() {
    return {
      id: this.name,
      name: this.place.getDisplayName(),
      description: this.info.description ?? '',
      latitude: this.place.latitude,
      longitude: this.place.longitude,
      type: this.info.type,
      score: this.score,
      scoreTime: this.scoreTime,
      nicheness: this.info.nicheness,
      popularity: this.info.popularity,
      certainty: this.info.certainty,
    };
  }

  getScore(): number | undefined {
    return this.score;
  }

  getScoreTime(): number | undefined {
    return this.scoreTime;
  }

  setScore(newScore: number, scoreTime: number = Date.now()): void {
    this.score = newScore;
    this.scoreTime = scoreTime;
  }
}

class GemService {
  private repo: GemRepo = new GemRepo();
  private gpClient: PlacesClient = new PlacesClient();

  private async getPlace(name: string): Promise<Place> {
    const req = { name };

    const res = await this.gpClient.getPlace(req);

    const gPlace = res[0];

    if (
      gPlace.name === undefined
      || gPlace.name === null
      || gPlace.location?.latitude === undefined
      || gPlace.location?.latitude === null
      || gPlace.location?.longitude === undefined
      || gPlace.location?.longitude === null
    ) {
      return Promise.reject(new Error('Invalid response from Google Map.'));
    }

    const place = new Place(gPlace.name, gPlace.location.latitude, gPlace.location.longitude);
    if (gPlace.displayName?.text) {
      place.setDisplayName(gPlace.displayName.text);
    }

    return place;
  }

  async getGem(name: string): Promise<Gem | undefined> {
    return this.repo.get(name);
  }

  async addGem(gem: Gem): Promise<boolean> {
    if (await this.repo.has(gem.name)) {
      return false;
    }

    return this.repo.set(gem.name, gem);
  }
}

// Leaves out undefined values; Mongo should not store them.
type DefinedOnly<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function definedOnly<T extends object>(obj: T): DefinedOnly<T> {
  return Object.fromEntries(Object.entries(obj).filter(([_k, v]) => v !== undefined)) as DefinedOnly<T>;
}

function toDoc(gem: Gem): GemInput {
  const place = gem.place;
  const doc: GemInput = {
    name: gem.name,
    place: {
      name: place.name,
      displayName: place.getDisplayName(),
      location: { type: 'Point', coordinates: [place.longitude, place.latitude] },
    },
    ...definedOnly(gem.info),
  };

  const score = gem.getScore();
  const scoreTime = gem.getScoreTime();
  if (score !== undefined) {
    doc.score = score;
  }
  if (scoreTime !== undefined) {
    doc.scoreTime = scoreTime;
  }

  return doc;
}

function fromDoc(doc: GemDoc): Gem {
  const [longitude, latitude] = doc.place.location.coordinates;
  if (longitude === undefined || latitude === undefined) {
    throw new Error(`Invalid location for Gem.`);
  }

  const place = new Place(doc.place.name, latitude, longitude);
  if (doc.place.displayName) {
    place.setDisplayName(doc.place.displayName);
  }

  const gem = new Gem(doc.name, place);
  gem.info = {
    description: doc.description ?? undefined,
    type: doc.type ?? undefined,
    nicheness: doc.nicheness ?? undefined,
    popularity: doc.popularity ?? undefined,
    certainty: doc.certainty ?? undefined,
    addedBy: doc.addedBy ?? undefined,
  };
  if (doc.score !== undefined && doc.score !== null) {
    gem.setScore(doc.score, doc.scoreTime ?? Date.now());
  }

  return gem;
}

class GemRepo {

  async create(name: string, place: Place): Promise<Gem> {
    const gem = new Gem(name, place);
    await GemModel.create(toDoc(gem));
    return gem;
  }

  async get(name: string): Promise<Gem | undefined> {
    const doc = await GemModel.findOne({ name }).lean<GemDoc>();
    return doc ? fromDoc(doc) : undefined;
  }

  async getOrCreate(name: string, place: Place): Promise<Gem> {
    return (await this.get(name)) ?? this.create(name, place);
  }

  async has(name: string): Promise<boolean> {
    return (await GemModel.exists({ name })) !== null;
  }

  // Insert or replace.
  async set(name: string, gem: Gem): Promise<boolean> {
    const res = await GemModel.replaceOne({ name }, toDoc(gem), { upsert: true });
    return res.acknowledged;
  }

}

export default GemService

