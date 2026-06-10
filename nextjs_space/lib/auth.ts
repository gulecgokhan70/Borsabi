import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
      }
      // Her token yenilemede DB'den güncel adı ve avatarı çek
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({ where: { id: token.id as string }, select: { name: true, avatar: true } });
          if (dbUser?.name) token.name = dbUser.name;
          token.avatar = dbUser?.avatar ?? null;
        } catch (_) {}
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).avatar = token.avatar;
        session.user.name = token.name;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
