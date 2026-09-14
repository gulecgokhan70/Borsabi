import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
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
      // Bind sessions to the immutable account ID. A deleted account's JWT must
      // never authenticate a new account that registers the same email address.
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({ where: { id: token.id as string }, select: { name: true, email: true, avatar: true, role: true } });
          token.accountValid = !!dbUser;
          if (dbUser) {
            token.name = dbUser.name;
            token.email = dbUser.email;
            token.avatar = dbUser.avatar;
            token.role = dbUser.role;
          }
        } catch { token.accountValid = false; }
      } else {
        token.accountValid = false;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (!token.id || token.accountValid !== true) return null;
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
