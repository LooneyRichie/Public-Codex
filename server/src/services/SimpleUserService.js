// Simple in-memory user service for when MongoDB isn't available
class SimpleUserService {
  constructor() {
    this.users = global.simpleStore?.users || new Map();
    this.nextId = 1;
  }

  async create(userData) {
    const id = this.nextId++;
    const user = {
      _id: id.toString(),
      id: id.toString(),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id.toString(), user);
    return user;
  }

  async findOne(query) {
    for (const [id, user] of this.users.entries()) {
      if (query.email && user.email === query.email) return user;
      if (query.username && user.username === query.username) return user;
      if (query._id && user._id === query._id) return user;
      if (query.$or) {
        for (const condition of query.$or) {
          if (condition.email && user.email === condition.email) return user;
          if (condition.username && user.username === condition.username) return user;
        }
      }
    }
    return null;
  }

  async findById(id) {
    return this.users.get(id.toString()) || null;
  }

  async save() {
    // For simple store, data is already saved in memory
    return this;
  }
}

module.exports = SimpleUserService;