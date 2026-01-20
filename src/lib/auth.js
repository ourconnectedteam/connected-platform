import { supabase } from './supabase.js';

export const auth = {
    // Sign Up
    async signUp(email, password, role) {
        // 1. Create Auth User
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { role } // Store in metadata too just in case
            }
        });

        console.log('SignUp Result:', { user: data.user?.id, session: !!data.session, error });

        if (error) return { data, error };

        // 2. Create Profile Entry manually
        if (data.user && data.session) {
            console.log('Attempting profile creation for', data.user.id);
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    role: role,
                    full_name: email.split('@')[0],
                    avatar_url: `https://ui-avatars.com/api/?name=${email}&background=random`
                });

            if (profileError) {
                console.error("Profile creation failed:", profileError);
                // We return the error but the auth user is created. 
                // The dashboard handles missing profiles by redirecting to onboarding.
                return { data, error: profileError };
            }
        }

        return { data, error };
    },

    // Sign In
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { data, error };
    },

    // Sign In with OAuth
    async signInWithOAuth(provider) {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: window.location.origin + '/onboarding.html'
            }
        });
        return { data, error };
    },

    // Sign Out
    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },

    // Get Current User
    async getUser() {
        const { data } = await supabase.auth.getUser();
        return data.user;
    },

    // Get Profile
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    },

    // Check if onboarding is complete
    async isOnboardingComplete() {
        const user = await this.getUser();
        if (!user) return false;

        const { data: profile } = await this.getProfile(user.id);
        return profile?.onboarding_complete || false;
    }
};
