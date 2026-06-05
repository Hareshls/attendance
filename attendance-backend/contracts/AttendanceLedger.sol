// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AttendanceLedger
 * @dev An immutable Web3 ledger for storing cryptographic proofs of worker attendance.
 */
contract AttendanceLedger {
    // Contract owner (usually the construction company admin)
    address public owner;

    // A struct to hold the hash block of a day's attendance
    struct DailyBatch {
        uint256 timestamp;
        bytes32 merkleRoot;       // The root hash of all attendance events for that day
        string supervisorId;      // The ID of the supervisor who submitted the batch
        uint256 totalRecords;     // Number of attendance events in the batch
    }

    // Mapping of Batch IDs to their Batch Records
    mapping(uint256 => DailyBatch) public batches;
    uint256 public nextBatchId;

    // Events to allow off-chain apps (like a Web Dashboard) to easily index new records
    event BatchMinted(uint256 indexed batchId, bytes32 merkleRoot, string supervisorId, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Mint a new cryptographic batch of offline attendance logs onto the Polygon blockchain.
     * @param _merkleRoot The SHA-256 root hash of the day's attendance logs
     * @param _supervisorId The string ID of the supervisor's device
     * @param _totalRecords The count of logs hashed into this root
     */
    function recordAttendanceBatch(bytes32 _merkleRoot, string calldata _supervisorId, uint256 _totalRecords) external {
        // In a real-world scenario, we might want only authorized supervisors to mint,
        // but for now anyone who interacts with the contract can submit a batch.
        
        batches[nextBatchId] = DailyBatch({
            timestamp: block.timestamp,
            merkleRoot: _merkleRoot,
            supervisorId: _supervisorId,
            totalRecords: _totalRecords
        });

        emit BatchMinted(nextBatchId, _merkleRoot, _supervisorId, block.timestamp);
        nextBatchId++;
    }

    /**
     * @dev Verify if a specific batch exists by its batch ID.
     */
    function getBatch(uint256 _batchId) external view returns (uint256, bytes32, string memory, uint256) {
        require(_batchId < nextBatchId, "Batch does not exist");
        DailyBatch memory b = batches[_batchId];
        return (b.timestamp, b.merkleRoot, b.supervisorId, b.totalRecords);
    }
}
