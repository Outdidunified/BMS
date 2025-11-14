import bannerImage from "@/assets/images/background/banner-1.png";
import { Icon } from "@/components/icon";
import { themeVars } from "@/theme/theme.css";
import { Avatar, AvatarImage, AvatarFallback } from "@/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Text, Title } from "@/ui/typography";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

interface UserData {
  username: string;
  email: string;
  role_id: number;
  role?: string;
  permissions?: Record<string, boolean>;
}

function UserProfile() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [formData, setFormData] = useState({ username: "", password: "" });

  const API_BASE =import.meta.env.VITE_APP_API_BASE_URL;

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem("authToken");
      if (!token) {
        toast.error("No auth token found");
        return;
      }

      const res = await fetch(`${API_BASE}/auth/getProfile`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setUserData(data.data);
        setFormData({ username: data.data.username, password: "" });
      } else {
        toast.error(data.message || "Failed to fetch profile");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const token = sessionStorage.getItem("authToken");
      if (!token) {
        toast.error("No auth token found");
        return;
      }

      const res = await fetch(`${API_BASE}/auth/updateProfile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: formData.username, password: formData.password }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Profile updated successfully");
        setEditMode(false);
        fetchProfile();
      } else {
        toast.error(data.message || "Failed to update profile");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating profile");
    }
  };

  const bgStyle = {
    position: "absolute",
    inset: 0,
    background: `url(${bannerImage})`,
    backgroundSize: "cover",
    backgroundPosition: "50%",
    backgroundRepeat: "no-repeat",
  } as React.CSSProperties;

  const getRoleName = (roleId: number) => {
    const roles: Record<number, string> = {
      1: "Administrator",
      2: "Manager",
      3: "Operator",
      4: "Viewer",
    };
    return roles[roleId] || "User";
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  if (loading) return <div className="text-center py-20">Loading...</div>;

  return (
    <Tabs defaultValue="Profile" className="w-full">
      <div className="relative flex flex-col justify-center items-center gap-4 p-4">
        <div style={bgStyle} className="h-full w-full z-1" />
        <div className="flex flex-col items-center justify-center gap-2 z-2">
          <Avatar className="h-24 w-24">
            <AvatarImage src="" />
            <AvatarFallback className="text-2xl font-bold">
              {userData?.username ? getInitials(userData.username) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col justify-center items-center gap-2">
            <div className="flex items-center gap-2">
              <Title as="h5" className="text-xl">
                {userData?.username || "User"}
              </Title>
              <Icon
                icon="heroicons:check-badge-solid"
                size={20}
                color={themeVars.colors.palette.primary.default}
              />
            </div>
            {/* <Text variant="body2">{userData?.role_id ? getRoleName(userData.role_id) : "User"}</Text> */}
          </div>
        </div>
        <TabsList className="z-5">
          <TabsTrigger value="Profile">
            <Icon icon="lucide:user" size={24} className="mr-2" />
            Profile
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="Profile">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-2xl font-bold">
                    {userData?.username ? getInitials(userData.username) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <Title as="h2" className="text-2xl font-bold">
                      {userData?.username || "User"}
                    </Title>
                    <Icon
                      icon="heroicons:check-badge-solid"
                      size={24}
                      color={themeVars.colors.palette.primary.default}
                    />
                  </div>
                  <Text variant="body1" className="text-muted-foreground mt-1">
                    {userData?.email || "No email"}
                  </Text>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex justify-between items-center">
              <div>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Your account details and role information</CardDescription>
              </div>
              <Button size="sm" onClick={() => setEditMode(!editMode)}>
                {editMode ? "Cancel" : "Update Profile"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon icon="mdi:account" size={20} />
                    <span className="font-medium">Username</span>
                  </div>
                  {editMode ? (
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  ) : (
                    <p className="text-base font-semibold pl-7">{userData?.username || "N/A"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon icon="mdi:email" size={20} />
                    <span className="font-medium">Email</span>
                  </div>
                  <p className="text-base font-semibold pl-7">{userData?.email || "N/A"}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon icon="mdi:shield-account" size={20} />
                    <span className="font-medium">Role</span>
                  </div>
                  <p className="text-base font-semibold pl-7">{userData?.role_id ? getRoleName(userData.role_id) : "N/A"}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon icon="mdi:identifier" size={20} />
                    <span className="font-medium">Role ID</span>
                  </div>
                  <p className="text-base font-semibold pl-7">{userData?.role_id || "N/A"}</p>
                </div>

                {editMode && (
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium">Password</span>
                    </div>
                    <Input
                      type="password"
                      placeholder="Enter new password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <Button onClick={handleUpdateProfile} className="mt-2">
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Permissions Card */}
          {userData?.permissions && (
            <Card>
              <CardHeader>
                <CardTitle>Permissions</CardTitle>
                <CardDescription>Your current system permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(userData.permissions)
                    .filter(([_, value]) => value)
                    .map(([key]) => {
                      const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <Icon icon="mdi:check-circle" size={20} className="text-green-600" />
                          <span className="text-sm">{label}</span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default UserProfile;
