import { PlacesClient } from "@googlemaps/places";

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

class Gem {
  readonly name: string;
  readonly place: Place;
  protected score?: number;
  protected scoreTime?: number;

  constructor(name: string, place: Place) {
    this.name = name;
    this.place = place;
  }

  setScore(newScore: number): void {
    this.score = newScore;
    this.scoreTime = Date.now();
  }
}

class GemService {
  private repo: GemRepo = new GemRepo();
  private gpClient: PlacesClient = new PlacesClient();

  private genGemId(): string {
    return crypto.randomUUID();
  }

  private async getPlace(name: string): Promise<Place> {
    const req = { name };

    const res = await this.gpClient.getPlace(req);

    const place = res[0];

    if (!place.name || !place.location || !place.location.latitude || !place.location.longitude) {
      return Promise.reject();
    }

    return new Place(place.name, place.location.latitude, place.location.longitude);
  }

  getGem(name: string): Gem | undefined {
    return this.repo.get(name);
  }

  addGem(gem: Gem): boolean {
    if (this.repo.has(gem.name)) {
      return false;
    }

    return this.repo.set(gem.name, gem);
  }
}

// HACK Stub for actual gem repo.
class GemRepo {

  // HACK Stub.
  create(name: string, place: Place): Gem {
    return new Gem(name, place);
  }

  // HACK Stub.
  get(name: string): Gem | undefined {
    return this.create(name, new Place('name/mitakihara', 0, 0));
  }

  // HACK Stub.
  getOrCreate(id: string, place?: Place): Gem {
    return this.get(id) ?? this.create(id, place!);
  }

  // HACK
  has(_name: string): boolean {
    return false;
  }

  // HACK Stub.
  set(name: string, gem: Gem): boolean {
    const _ = [name, gem];
    return true;
  }

}

export default GemService

