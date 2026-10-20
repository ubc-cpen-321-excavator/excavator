import { PlacesClient } from "@googlemaps/places";

interface Place {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string;
}

class Gem {
  readonly id: string;
  readonly place: Place;
  protected score?: number;
  protected scoreTime?: number;

  constructor(id: string, place: Place) {
    this.id = id;
    this.place = place;
  }

  setScore(newScore: number) {
    this.score = newScore;
    this.scoreTime = Date.now();
  }
}

class GemService {
  private db: GemDB = new GemDB();
  private gpClient: PlacesClient = new PlacesClient();


  private genGemId(): string {
    return crypto.randomUUID();
  }

  // TODO
  private async getPlaceByName(name: string): Promise<Place> {
    const req = {
      name: name
    };

    const _res = await this.gpClient.getPlace(req);

    return Promise.reject();
  }

  getGemByPlace(place: Place): Gem | undefined {
    return this.db.getByPlace(place);
  }

  getGemByPlaceName(name: string): Gem | undefined {
    return this.db.getByPlaceName(name);
  }
}

// HACK Stub for actual gem repo.
class GemDB {

  // HACK Stub.
  create(id: string, place: Place): Gem {
    return new Gem(id, place);
  }

  // HACK Stub.
  get(id: string): Gem | undefined {
    return this.create(id, { id: '37', name: 'mitakihara' });
  }

  // HACK Stub.
  getOrCreate(id: string, place?: Place): Gem {
    return this.get(id) ?? this.create(id, place!);
  }

  // HACK Stub.
  set(_id: string, _gem: Gem): boolean {
    return true;
  }

  // HACK Stub.
  getByPlace(place: Place): Gem | undefined {
    return this.create('37', place);
  }

  // HACK Stub.
  getByPlaceName(name: string): Gem | undefined {
    return this.create('37', { id: '37', name: name });
  }
}
