const { AccessToken } = require("livekit-server-sdk");

/**
 * Make strings LiveKit-safe
 * (no spaces, no special chars)
 */
const sanitize = (value = "") =>
  value.toString().replace(/[^a-zA-Z0-9_-]/g, "");

// Extract JWT from cookies OR Authorization header
const getClientToken = (req) => {
  if (req.cookies?.token) return req.cookies.token;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

/**
 * Generate room name:
 * reportNumber_currentTime_token
 */
const generateRoomName = (reportNumber, clientToken) => {
  const timestamp = Date.now();

  return `${sanitize(reportNumber)}_${timestamp}_${sanitize(clientToken)}`;
};

// Create LiveKit Access Token

const createAccessToken = async (roomName, participantName, metadata) => {
  try {
    const accessToken = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName,
        metadata: JSON.stringify(metadata),
        ttl: 600, // 10 minutes
      }
    );

    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      roomAdmin: true,
    });

    return await accessToken.toJwt();
  } catch (error) {
    throw new Error(`Failed to create access token: ${error.message}`);
  }
};

// API Controller
exports.getToken = async (req, res) => {
  try {
    const { reportNumber } = req.body;
    const userEmail = req.user?.email;
    const clientToken = getClientToken(req);

    if (!reportNumber) {
      return res.status(400).json({
        success: false,
        message: "reportNumber is required",
      });
    }

    if (!clientToken) {
      return res.status(401).json({
        success: false,
        message: "Client token not found in cookies or headers",
      });
    }

    // Build room + participant
    const roomName = generateRoomName(reportNumber, clientToken);
    const participantName = userEmail || `user_${Date.now()}`;

    // Generate LiveKit token
    const token = await createAccessToken(roomName, participantName, {
      email: userEmail,
      reportNumber,
    });

    res.status(200).json({
      success: true,
      message: "LiveKit token generated",
      data: {
        token,
        roomName,
        participantName,
      },
    });
  } catch (error) {
    console.error("LiveKit token error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating LiveKit token",
      error: error.message,
    });
  }
};
