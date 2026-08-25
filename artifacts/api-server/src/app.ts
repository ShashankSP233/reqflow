import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import { randomBytes } from "crypto";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  logger.warn(
    "SESSION_SECRET is not set — using a random value generated at startup. " +
    "That's fine for local testing, but it means everyone gets logged out " +
    "whenever the server restarts. Set SESSION_SECRET to a fixed value " +
    "before a real launch."
  );
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Local dev/pilot runs over plain http — set this true once the real
      // launch serves the app over https.
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

app.use("/api", router);

export default app;
