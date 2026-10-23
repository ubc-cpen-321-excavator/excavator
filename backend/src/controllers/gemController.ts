import express from "express";
import GemService from "../services/gemService";
import { alphnumDashOnly } from "../utils/trust";

export const gemRouter = express.Router();

export const gemService = new GemService();

gemRouter.get('/get', (req, res) => {
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

