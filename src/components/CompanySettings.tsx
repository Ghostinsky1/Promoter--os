import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CompanySettings as CompanySettingsType } from '../types';
import { Upload, X, Check, ArrowLeft, Save, Users, UserPlus, Trash2, Building2 } from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  subscription_tier: string;
  max_seats: number;
}

export function CompanySettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'company' | 'team'>('company');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [legalTerms, setLegalTerms] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTeamData();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('No user found');
        setIsLoading(false);
        return;
      }

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!memberData?.organization_id) {
        console.error('No organization found');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('organization_id', memberData.organization_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setCompanyName(data.company_name || '');
        setContactName(data.contact_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setWebsite(data.website || '');
        setAddress(data.business_address || '');
        setLogoUrl(data.logo_url || '');
        setLegalTerms(data.legal_terms || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!memberData?.organization_id) return;

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, subscription_tier, max_seats')
        .eq('id', memberData.organization_id)
        .maybeSingle();

      if (orgData) {
        setOrganization(orgData);
      }

      const { data: membersData } = await supabase
        .from('organization_members')
        .select('id, user_id, role, created_at')
        .eq('organization_id', memberData.organization_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (membersData) {
        const currentUser = await supabase.auth.getUser();
        const membersWithEmails = membersData.map((member) => ({
          ...member,
          email: member.user_id === currentUser.data.user?.id
            ? currentUser.data.user?.email || 'Unknown'
            : `Member ${member.user_id.substring(0, 8)}`
        }));
        setTeamMembers(membersWithEmails);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    if (!organization) {
      alert('Organization not loaded');
      return;
    }

    if (teamMembers.length >= organization.max_seats) {
      alert(`You've reached the maximum number of seats (${organization.max_seats}) for your plan`);
      return;
    }

    setIsAddingMember(true);

    try {
      alert(`Invitation functionality coming soon! Send an invite to ${newMemberEmail} to join your team.`);
      setNewMemberEmail('');
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add team member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;

      alert('Team member removed successfully');
      loadTeamData();
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove team member');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadLogo(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadLogo(e.target.files[0]);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setLogoUrl(base64);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert('Failed to upload logo');
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (!companyName) {
      alert('Company name is required');
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('User not authenticated');
        return;
      }

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!memberData?.organization_id) {
        alert('No organization found');
        return;
      }

      const { data: existingData } = await supabase
        .from('company_settings')
        .select('id')
        .eq('organization_id', memberData.organization_id)
        .maybeSingle();

      const settingsData = {
        user_id: user.id,
        organization_id: memberData.organization_id,
        company_name: companyName,
        contact_name: contactName,
        email: email,
        phone: phone,
        website: website,
        business_address: address,
        logo_url: logoUrl,
        legal_terms: legalTerms,
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', existingData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert([settingsData]);

        if (error) throw error;
      }

      alert('Settings saved successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F1113] flex items-center justify-center">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1113]">
      <div className="bg-[#1A1F1E] border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <h1 className="text-3xl font-bold mb-2 text-white">Settings</h1>
          <p className="text-gray-400">Manage your company information and team</p>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setActiveTab('company')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'company'
                  ? 'bg-[#C4FF0D] text-black'
                  : 'bg-[#252A29] text-gray-400 hover:text-white hover:bg-[#2D3331]'
              }`}
            >
              <Building2 className="h-5 w-5" />
              Company Info
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'bg-[#C4FF0D] text-black'
                  : 'bg-[#252A29] text-gray-400 hover:text-white hover:bg-[#2D3331]'
              }`}
            >
              <Users className="h-5 w-5" />
              Team
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'company' && (
          <div className="bg-[#1A1F1E] border border-gray-800 rounded-3xl p-8">
          <h2 className="text-2xl font-bold mb-8 text-white">Company Information</h2>

          <div className="mb-8">
            <h3 className="text-lg font-bold mb-2 text-white">Company Logo</h3>
            <p className="text-sm text-gray-400 mb-4">
              Upload your logo to appear on all offer PDFs
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#C4FF0D] bg-[#C4FF0D]/10'
                    : 'border-gray-700 hover:border-[#C4FF0D] hover:bg-[#C4FF0D]/5'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('logo-upload')?.click()}
              >
                <div className="w-16 h-16 bg-[#252A29] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-gray-400" />
                </div>
                <div className="font-semibold mb-1 text-white">
                  Click to upload or drag and drop
                </div>
                <div className="text-sm text-gray-500">PNG, JPG up to 2MB</div>

                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {logoUrl ? (
                <div className="border-2 border-gray-700 rounded-2xl p-6 bg-[#141716] relative">
                  <button
                    className="absolute top-2 right-2 bg-[#252A29] shadow-md p-2 rounded-full hover:bg-[#2D3331] transition-colors z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoUrl('');
                    }}
                  >
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      className="max-h-40 object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-700 rounded-2xl p-6 flex items-center justify-center min-h-[200px]">
                  <div className="text-center text-gray-500">
                    <p className="text-sm">Logo preview will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold mb-2 text-white">
                Company Name *
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Goza Entertainment"
                className="w-full text-lg px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-semibold mb-2 text-white">
                  Contact Name
                </label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jose Huaroco"
                  className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
                />
              </div>

              <div>
                <label className="block text-base font-semibold mb-2 text-white">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jhuaroco@gozaentertainment.com"
                  className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-semibold mb-2 text-white">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
                />
              </div>

              <div>
                <label className="block text-base font-semibold mb-2 text-white">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://gozaentertainment.com"
                  className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold mb-2 text-white">
                Business Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St&#10;Suite 100&#10;City, State 12345"
                rows={4}
                className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
              />
            </div>

            <div>
              <label className="block text-base font-semibold mb-2 text-white">
                Legal Terms & Conditions
              </label>
              <p className="text-sm text-gray-400 mb-3">
                Add your standard terms and conditions to appear on artist offer documents
              </p>
              <textarea
                value={legalTerms}
                onChange={(e) => setLegalTerms(e.target.value)}
                rows={8}
                placeholder="Enter your terms and conditions here...&#10;&#10;Example:&#10;- Offer expires 15 days from submission&#10;- Artist responsible for travel/hotel/backline&#10;- Performance minimum 75 minutes&#10;- Meet & greet for radio winners..."
                className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-800">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-700 text-gray-300 rounded-2xl font-semibold hover:bg-[#252A29] hover:border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-[#C4FF0D] hover:bg-[#A3D60A] text-black rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-[#1A1F1E] border border-gray-800 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">Team Management</h2>
                <p className="text-gray-400 mt-1">
                  Manage your team members and seats
                </p>
              </div>
              {organization && (
                <div className="text-right">
                  <div className="text-sm text-gray-400">Seats Used</div>
                  <div className="text-2xl font-bold text-white">
                    {teamMembers.length} / {organization.max_seats}
                  </div>
                </div>
              )}
            </div>

            {organization && teamMembers.length < organization.max_seats && (
              <div className="bg-[#252A29] border border-gray-700 rounded-2xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Add Team Member</h3>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="teammate@email.com"
                    className="flex-1 px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                  />
                  <button
                    onClick={handleAddMember}
                    disabled={isAddingMember}
                    className="px-6 py-3 bg-[#C4FF0D] hover:bg-[#A3D60A] text-black rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    <UserPlus className="h-5 w-5" />
                    Add Member
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  Available seats: {organization.max_seats - teamMembers.length} of {organization.max_seats}
                </p>
              </div>
            )}

            {organization && teamMembers.length >= organization.max_seats && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-8">
                <p className="text-amber-400 font-semibold">
                  You've reached your seat limit ({organization.max_seats} seats)
                </p>
                <p className="text-amber-300/70 text-sm mt-1">
                  Upgrade your plan to add more team members
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white mb-4">Current Team Members</h3>
              {teamMembers.map((member, index) => (
                <div
                  key={member.id}
                  className="bg-[#252A29] border border-gray-700 rounded-xl p-5 flex items-center justify-between hover:bg-[#2D3331] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#C4FF0D] rounded-full flex items-center justify-center">
                      <span className="text-black font-bold text-lg">
                        {member.email?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{member.email}</div>
                      <div className="text-sm text-gray-400 capitalize">{member.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {index === 0 ? (
                      <span className="px-3 py-1 bg-[#C4FF0D]/20 text-[#C4FF0D] rounded-lg text-sm font-medium">
                        Owner
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {teamMembers.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No team members yet
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
