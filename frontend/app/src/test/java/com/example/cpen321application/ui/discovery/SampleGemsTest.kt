package com.example.cpen321application.ui.discovery

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SampleGemsTest {

    @Test
    fun sampleGems_haveUniqueIds() {
        // DiscoveryScreen keys each marker by gem id, so duplicate ids would mix up pins and selection.
        val uniqueIds = sampleGems.map { it.id }.toSet()
        assertEquals(sampleGems.size, uniqueIds.size)
    }

    @Test
    fun sampleGems_haveValidCoordinates() {
        sampleGems.forEach { gem ->
            assertTrue("${gem.id} latitude out of range", gem.latitude in -90.0..90.0)
            assertTrue("${gem.id} longitude out of range", gem.longitude in -180.0..180.0)
        }
    }
}
