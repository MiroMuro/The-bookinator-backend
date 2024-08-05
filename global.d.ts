/* eslint-disable no-var */
import { GridFSBucket } from "mongodb";

declare global {
  var gfs: GridFSBucket | undefined;
}
