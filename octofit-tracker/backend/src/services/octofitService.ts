import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Activity payload is required'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as {
    userId?: string;
    teamId?: string;
    type?: string;
    minutes?: unknown;
  };

  if (!userId || !teamId || !type || minutes === undefined || minutes === null || minutes === '') {
    throw Object.assign(new Error('userId, teamId, type, and minutes are required'), { status: 400 });
  }

  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(teamId)) {
    throw Object.assign(new Error('userId and teamId must be valid ObjectIds'), { status: 400 });
  }

  const minuteCount = Number(minutes);
  if (!Number.isFinite(minuteCount) || minuteCount <= 0) {
    throw Object.assign(new Error('minutes must be a positive number'), { status: 400 });
  }

  const user = await User.findById(userId);
  const team = await Team.findById(teamId);

  if (!user || !team) {
    throw Object.assign(new Error('User and team must exist'), { status: 400 });
  }

  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type: String(type).trim(),
    minutes: minuteCount,
    points: minuteCount,
    occurredAt: new Date(),
  });

  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Team payload is required'), { status: 400 });
  }

  const { name, mascot, members } = input as {
    name?: unknown;
    mascot?: unknown;
    members?: unknown;
  };
  if (typeof name !== 'string' || !name.trim() || typeof mascot !== 'string' || !mascot.trim()) {
    throw Object.assign(new Error('name and mascot are required'), { status: 400 });
  }

  if (members !== undefined && !Array.isArray(members)) {
    throw Object.assign(new Error('members must be an array of user IDs'), { status: 400 });
  }
  const memberIds = (members ?? []) as unknown[];
  if (memberIds.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
    throw Object.assign(new Error('members must contain valid user IDs'), { status: 400 });
  }

  const users = memberIds.length ? await User.find({ _id: { $in: memberIds } }).select('_id') : [];
  if (users.length !== memberIds.length) {
    throw Object.assign(new Error('All team members must exist'), { status: 400 });
  }

  return Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: users.map(({ _id }) => _id),
  });
}

export async function getLeaderboard() {
  const teams = await Team.aggregate<{ teamName: string; totalPoints: number }>([
    {
      $lookup: {
        from: Activity.collection.name,
        localField: '_id',
        foreignField: 'team',
        as: 'activities',
      },
    },
    {
      $project: {
        _id: 0,
        teamName: '$name',
        totalPoints: { $sum: '$activities.points' },
      },
    },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);

  return teams.map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const recentActivity = await Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).lean();
  const activityFocus = recentActivity
    ? ({ run: 'endurance', cycle: 'endurance', strength: 'strength', walk: 'mobility' } as Record<string, string>)[recentActivity.type.toLowerCase()]
    : undefined;
  const preferredFocuses = [...new Set([user.fitnessGoal.toLowerCase(), activityFocus].filter((focus): focus is string => Boolean(focus)))];
  if (preferredFocuses.length === 0) return [];

  const workouts = await Workout.find({ focus: { $in: preferredFocuses } }).lean();
  workouts.sort((left, right) => preferredFocuses.indexOf(left.focus.toLowerCase()) - preferredFocuses.indexOf(right.focus.toLowerCase()));

  return workouts.map((workout) => ({
    ...workout,
    reason: activityFocus && workout.focus.toLowerCase() === activityFocus
      ? `Recommended based on your recent ${recentActivity?.type} activity.`
      : `Recommended to support your ${user.fitnessGoal} fitness goal.`,
  }));
}

export { User };
