import express from "express";
import GemService, { Gem } from "../services/gemService";
import { alphnumDashOnly } from "../utils/trust";

export const gemRouter = express.Router();

export const gemService = new GemService();

gemRouter.get('/', (req, res) => {
  const { name } = req.query;
  if (!name || typeof (name) !== 'string') {
    res.status(400).json({ message: 'Invalid Gem name.' });
    return;
  }

  gemService.getGem(name)
    .then(gem => {
      if (!gem) {
        res.status(404).json({ message: 'No such Gem.' });
        return;
      }

      res.json(gem);
    })
    .catch(err => {
      console.log(`Get Gem failed: ${alphnumDashOnly(err)}`);
      res.status(500).json({ message: 'Get Gem failed.' });
    });
});

gemRouter.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ message: 'Invalid place name.' });
    return;
  }

  // TODO reqSession, then fill user ID
  const added = await gemService.addGem(name, '37');
  if (added === undefined) {
    // Client is supposed to supply valid place name, so 400
    res.status(400).json({ message: 'Place does not exist.' });
    return;
  }

  // NOTE can also use codes like 201, 409
  res.json({ added });
});

