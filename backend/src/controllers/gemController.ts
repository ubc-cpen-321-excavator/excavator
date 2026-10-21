import express from "express";
import GemService from "../services/gemService";

export const gemRouter = express.Router();

export const gemService = new GemService();

gemRouter.get('/get', (req, res) => {
  const { name } = req.query;
  if (!name || typeof (name) !== 'string') {
    res.status(400).json({ message: 'Invalid Gem name.' });
    return;
  }

  const gem = gemService.getGem(name);

  if (!gem) {
    res.status(404).json({message: 'No such Gem.'});
    return;
  }

  res.json(gem);
});

