import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // 1. Create super admin user
  const adminUser = await db.user.upsert({
    where: { email: "admin@postsyncer.com" },
    update: {},
    create: {
      email: "admin@postsyncer.com",
      name: "Admin User",
      role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash("admin123!", 10),
      emailVerified: new Date(),
    },
  });

  // 2. Create demo user
  const demoUser = await db.user.upsert({
    where: { email: "demo@postsyncer.com" },
    update: {},
    create: {
      email: "demo@postsyncer.com",
      name: "Demo User",
      passwordHash: await bcrypt.hash("demo123!", 10),
      emailVerified: new Date(),
    },
  });

  // 3. Create demo workspace with Pro plan
  const workspace = await db.workspace.upsert({
    where: { slug: "demo-workspace" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo-workspace",
      ownerId: demoUser.id,
      plan: "PRO",
      members: {
        create: {
          userId: demoUser.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      },
      settings: {
        create: {
          aiCreditsUsed: 150,
          aiCreditsLimit: 1000,
        },
      },
      subscription: {
        create: {
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  // 4. Create admin workspace so admin has a workspace too
  await db.workspace.upsert({
    where: { slug: "admin-workspace" },
    update: {},
    create: {
      name: "Admin Workspace",
      slug: "admin-workspace",
      ownerId: adminUser.id,
      plan: "PRO_PLUS",
      members: {
        create: {
          userId: adminUser.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      },
      settings: {
        create: {
          aiCreditsUsed: 0,
          aiCreditsLimit: 2000,
        },
      },
      subscription: {
        create: {
          plan: "PRO_PLUS",
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  // 5. Create mock social accounts (3 platforms)
  const twitterAccount = await db.socialAccount.upsert({
    where: {
      workspaceId_platform_platformId: {
        workspaceId: workspace.id,
        platform: "TWITTER",
        platformId: "demo_twitter_123",
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      platform: "TWITTER",
      platformId: "demo_twitter_123",
      username: "democreator",
      displayName: "Demo Creator",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=twitter",
      status: "ACTIVE",
      accessToken: "mock_twitter_token",
      scopes: ["tweet.read", "tweet.write"],
    },
  });

  const instagramAccount = await db.socialAccount.upsert({
    where: {
      workspaceId_platform_platformId: {
        workspaceId: workspace.id,
        platform: "INSTAGRAM",
        platformId: "demo_instagram_456",
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      platform: "INSTAGRAM",
      platformId: "demo_instagram_456",
      username: "democreator",
      displayName: "Demo Creator",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=instagram",
      status: "ACTIVE",
      accessToken: "mock_instagram_token",
      scopes: ["instagram_basic", "instagram_content_publish"],
    },
  });

  const linkedinAccount = await db.socialAccount.upsert({
    where: {
      workspaceId_platform_platformId: {
        workspaceId: workspace.id,
        platform: "LINKEDIN",
        platformId: "demo_linkedin_789",
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      platform: "LINKEDIN",
      platformId: "demo_linkedin_789",
      username: "democreator",
      displayName: "Demo Creator",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=linkedin",
      status: "ACTIVE",
      accessToken: "mock_linkedin_token",
      scopes: ["r_liteprofile", "w_member_social"],
    },
  });

  // 6. Create labels
  const [marketingLabel, productLabel, engagementLabel] = await Promise.all([
    db.label.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Marketing" } },
      update: {},
      create: { workspaceId: workspace.id, name: "Marketing", color: "#6366f1" },
    }),
    db.label.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Product" } },
      update: {},
      create: { workspaceId: workspace.id, name: "Product", color: "#22c55e" },
    }),
    db.label.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Engagement" } },
      update: {},
      create: { workspaceId: workspace.id, name: "Engagement", color: "#f59e0b" },
    }),
  ]);

  // 7. Create sample posts (mix of statuses)
  const samplePosts: Array<{
    content: string;
    status: string;
    daysOffset: number | null;
    labelId: string;
  }> = [
    {
      content:
        "Excited to announce our latest feature launch! We've been working hard on this one — multi-platform scheduling just got a whole lot smarter.",
      status: "PUBLISHED",
      daysOffset: -5,
      labelId: productLabel.id,
    },
    {
      content:
        "Here's a quick tip for growing your social media presence: consistency is key! Post every day at the same time and watch your engagement climb.",
      status: "PUBLISHED",
      daysOffset: -3,
      labelId: marketingLabel.id,
    },
    {
      content:
        "Behind the scenes look at our team working on new features. Great things coming soon — stay tuned!",
      status: "SCHEDULED",
      daysOffset: 1,
      labelId: engagementLabel.id,
    },
    {
      content:
        "We're hiring! Looking for talented developers who want to change how the world uses social media. DM us or check the link in bio.",
      status: "SCHEDULED",
      daysOffset: 3,
      labelId: marketingLabel.id,
    },
    {
      content:
        "Q&A time! Drop your questions below and we'll answer them in our next post. Nothing is off limits.",
      status: "DRAFT",
      daysOffset: null,
      labelId: engagementLabel.id,
    },
  ];

  for (const post of samplePosts) {
    const scheduledAt =
      post.daysOffset !== null
        ? new Date(Date.now() + post.daysOffset * 24 * 60 * 60 * 1000)
        : null;

    await db.post.create({
      data: {
        workspaceId: workspace.id,
        content: post.content,
        status: post.status as any,
        scheduledAt,
        publishedAt: post.status === "PUBLISHED" ? scheduledAt : null,
        accounts: {
          create: [
            { socialAccountId: twitterAccount.id, status: post.status as any },
            { socialAccountId: instagramAccount.id, status: post.status as any },
          ],
        },
        labels: {
          create: [{ labelId: post.labelId }],
        },
      },
    });
  }

  // 8. Create sample analytics data (last 30 days)
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    await db.analyticsSnapshot.upsert({
      where: { socialAccountId_date: { socialAccountId: twitterAccount.id, date } },
      update: {},
      create: {
        workspaceId: workspace.id,
        socialAccountId: twitterAccount.id,
        platform: "TWITTER",
        date,
        impressions: Math.floor(Math.random() * 5000) + 500,
        engagements: Math.floor(Math.random() * 300) + 50,
        likes: Math.floor(Math.random() * 200) + 20,
        comments: Math.floor(Math.random() * 30) + 5,
        shares: Math.floor(Math.random() * 50) + 5,
        followerCount: 12500 + (30 - i) * 15,
        followerChange: Math.floor(Math.random() * 30),
      },
    });

    await db.analyticsSnapshot.upsert({
      where: { socialAccountId_date: { socialAccountId: instagramAccount.id, date } },
      update: {},
      create: {
        workspaceId: workspace.id,
        socialAccountId: instagramAccount.id,
        platform: "INSTAGRAM",
        date,
        impressions: Math.floor(Math.random() * 8000) + 1000,
        engagements: Math.floor(Math.random() * 500) + 80,
        likes: Math.floor(Math.random() * 400) + 50,
        comments: Math.floor(Math.random() * 60) + 10,
        shares: Math.floor(Math.random() * 80) + 10,
        saves: Math.floor(Math.random() * 100) + 20,
        followerCount: 8200 + (30 - i) * 25,
        followerChange: Math.floor(Math.random() * 50),
      },
    });
  }

  console.log("✅ Seed complete");
  console.log("Demo login: demo@postsyncer.com / demo123!");
  console.log("Admin login: admin@postsyncer.com / admin123!");
}

main().catch(console.error).finally(() => db.$disconnect());
