import type { AssignRoleDto, CreateUserDto, RoleDto, UserDto } from '@platform/shared-types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUsersStore = defineStore('users', () => {
  const users = ref<UserDto[]>([])
  const roles = ref<RoleDto[]>([])
  const loaded = ref(false)

  async function loadUsers(): Promise<void> {
    users.value = await window.platform.users.list()
    loaded.value = true
  }

  async function loadRoles(): Promise<void> {
    roles.value = await window.platform.users.listRoles()
  }

  async function createUser(dto: CreateUserDto): Promise<UserDto> {
    const created = await window.platform.users.create(dto)
    users.value = [created, ...users.value]
    return created
  }

  async function assignRole(userId: number, roleId: number): Promise<void> {
    const dto: AssignRoleDto = { userId, roleId }
    const updated = await window.platform.users.assignRole(dto)
    const index = users.value.findIndex((item) => item.id === userId)
    if (index !== -1) {
      users.value[index] = updated
    }
  }

  return {
    users,
    roles,
    loaded,
    loadUsers,
    loadRoles,
    createUser,
    assignRole,
  }
})
