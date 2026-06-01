import {
  tripHealth,
  createTrip,
  getTripById,
  getTripsByUserId,
  getTripsByGroupId,
  endTrip,
  deleteTrip,
  addTripMember,
  removeTripMember,
} from "./trip.service.js";

export function tripHealthController() {
  return tripHealth();
}

export async function createTripController(body: unknown, ownerUserId: string) {
  return createTrip(body, ownerUserId);
}

export async function getTripByIdController(tripId: string) {
  return getTripById(tripId);
}

export async function getTripsByUserIdController(userId: string) {
  return getTripsByUserId(userId);
}

export async function getTripsByGroupIdController(groupId: string) {
  return getTripsByGroupId(groupId);
}

export async function endTripController(tripId: string, requestingUserId: string) {
  return endTrip(tripId, requestingUserId);
}

export async function deleteTripController(tripId: string, requestingUserId: string) {
  return deleteTrip(tripId, requestingUserId);
}

export async function addTripMemberController(tripId: string, body: unknown, requestingUserId: string) {
  return addTripMember(tripId, body, requestingUserId);
}

export async function removeTripMemberController(
  tripId: string,
  userId: string,
  requestingUserId: string,
) {
  return removeTripMember(tripId, userId, requestingUserId);
}
