import {
  groupHealth,
  createGroup,
  getGroupById,
  addGroupMember,
  removeGroupMember,
  getGroupsByUserId,
  deleteGroup,
} from "./group.service.js";
import { getGroupLatestLocations } from "../location/location.service.js";

export function groupController() {
  return groupHealth();
}

export async function createGroupController(input: unknown, ownerUserId: string) {
  return createGroup(input, ownerUserId);
}

export async function getGroupByIdController(groupId: string) {
  return getGroupById(groupId);
}

export async function addGroupMemberController(
  groupId: string,
  input: unknown,
  requesterUserId: string,
) {
  return addGroupMember(groupId, input, requesterUserId);
}

export async function removeGroupMemberController(
  groupId: string,
  targetUserId: string,
  requesterUserId: string,
) {
  return removeGroupMember(groupId, targetUserId, requesterUserId);
}

export async function getGroupsByUserIdController(userId: string) {
  return getGroupsByUserId(userId);
}

export async function deleteGroupController(groupId: string, requesterUserId: string) {
  return deleteGroup(groupId, requesterUserId);
}

export async function getGroupLatestLocationsController(groupId: string) {
  return getGroupLatestLocations(groupId);
}
