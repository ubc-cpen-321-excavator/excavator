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
  getOrCreate(id: string, place: Place): Gem {
    return this.get(id) ?? this.create(id, place);
  }

  // HACK
  has(_name: string): boolean {
    return false;
  }

  // HACK Stub.
  set(_name: string, _gem: Gem): boolean {
    return true;
  }

}

export default GemService

