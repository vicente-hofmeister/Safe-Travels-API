import {
  locationHealth,
  registerLocation,
  getLocationById,
  getLocationByUserId,
  type RegisterLocationInput,
} from "./location.service.js";

export function locationController() {
  return locationHealth();
}

export async function registerLocationController(input: RegisterLocationInput) {
  return registerLocation(input);
}

export async function getLocationByIdController(locationEventId: unknown) {
  return getLocationById(locationEventId);
}

export async function getLocationByUserIdController(userId: unknown) {
  return getLocationByUserId(userId);
}
