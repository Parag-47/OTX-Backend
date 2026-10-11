import { Router } from "express";
import { checkAuthentication } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validateDto.middleware.js";
import { validateAddToWatchlist } from "../validation/jsonSchema.js";
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  checkWatchlistStatus,
  clearWatchlist,
} from "../controllers/watchlist.controller.js";

const router = Router();

// Protect all watchlist endpoints with session authentication
router.use(checkAuthentication);

router
  .route("/")
  .get(getWatchlist)
  .post(validateBody(validateAddToWatchlist), addToWatchlist)
  .delete(clearWatchlist);

router
  .route("/:stockId")
  .get(checkWatchlistStatus)
  .delete(removeFromWatchlist);

export default router;
